"""Job leads: the submit agent proposes, a sourcing session reviews."""

import asyncio
from datetime import date

import pytest
from fastapi.testclient import TestClient
from fastmcp import Client

import main

ADMIN = {"x-admin-secret": "test-admin-secret"}
client = TestClient(main.app)

URL = "https://jobs.ashbyhq.com/acme/1234"


def propose(url=URL, **extra):
    return client.post("/api/leads", json={"applyUrl": url, "company": "Acme", "role": "SWE", **extra}, headers=ADMIN)


def queue(url, day="2026-10-15"):
    r = client.put(
        "/api/to_apply",
        json={"queueDate": day, "rows": [{"company": "Acme", "role": "SWE", "applyUrl": url}]},
        headers=ADMIN,
    )
    assert r.status_code == 200, r.text


# ---- URL cleanup -----------------------------------------------------------

def test_clean_url_drops_fragment_and_utm_but_keeps_job_id():
    got = main._clean_lead_url("  HTTPS://Boards.Greenhouse.io/acme/jobs?gh_jid=42&utm_source=x&UTM_medium=y#apply ")
    assert got == "https://boards.greenhouse.io/acme/jobs?gh_jid=42"


@pytest.mark.parametrize(
    "bad",
    [
        "http://jobs.example.com/1",  # not https
        "javascript:alert(1)",
        "https://user:pw@jobs.example.com/1",  # credentials inside
        "https://" + "a" * 2000 + ".com",  # too long
        "not a url",
    ],
)
def test_bad_url_is_422(bad):
    assert propose(bad).status_code == 422


# ---- propose ---------------------------------------------------------------

def test_propose_stores_a_cleaned_one_line_lead():
    r = propose(URL + "?utm_campaign=z", note="line one\n  line two " + "x" * 400, foundVia="email")
    assert r.status_code == 200, r.text
    lead = r.json()
    assert lead["applyUrl"] == URL
    assert lead["status"] == "proposed"
    assert lead["foundVia"] == "email"
    assert "\n" not in lead["note"] and len(lead["note"]) == main.LEAD_NOTE_MAX


def test_unknown_found_via_is_422():
    assert propose(foundVia="carrier-pigeon").status_code == 422


def test_same_lead_twice_is_409_with_status():
    assert propose().status_code == 200
    r = propose(URL + "#again")  # same URL after cleanup
    assert r.status_code == 409
    assert r.json()["detail"]["status"] == "proposed"


def test_url_already_on_the_queue_is_409():
    queue(URL)
    r = propose()
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "already on the queue"


def test_url_already_applied_is_409():
    queue(URL)
    row_id = client.get("/api/to_apply", headers=ADMIN).json()["rows"][0]["id"]
    assert client.post(f"/api/to_apply/{row_id}/apply", headers=ADMIN).status_code == 200
    # The queue match fires first; drop the queue row to prove the applications check too.
    with main.SessionLocal() as s:
        s.delete(s.get(main.ToApply, row_id))
        s.commit()
    r = propose()
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "already applied"


def test_daily_cap_is_429(monkeypatch):
    monkeypatch.setattr(main, "LEAD_DAILY_CAP", 2)
    assert propose(URL + "/a").status_code == 200
    assert propose(URL + "/b").status_code == 200
    assert propose(URL + "/c").status_code == 429


def test_routes_need_the_master_secret():
    assert client.post("/api/leads", json={"applyUrl": URL}).status_code == 401
    assert client.get("/api/leads", headers={"x-admin-secret": "test-daily-secret"}).status_code == 401


# ---- list + review ---------------------------------------------------------

def test_list_defaults_to_proposed_oldest_first():
    a = propose(URL + "/a").json()["id"]
    b = propose(URL + "/b").json()["id"]
    client.patch(f"/api/leads/{a}", json={"decision": "rejected", "reviewNote": "closed"}, headers=ADMIN)
    assert [x["id"] for x in client.get("/api/leads", headers=ADMIN).json()] == [b]
    assert [x["id"] for x in client.get("/api/leads?status=all", headers=ADMIN).json()] == [a, b]


def test_accept_needs_queue_date_and_reject_needs_note():
    lid = propose().json()["id"]
    assert client.patch(f"/api/leads/{lid}", json={"decision": "accepted"}, headers=ADMIN).status_code == 422
    assert client.patch(f"/api/leads/{lid}", json={"decision": "rejected"}, headers=ADMIN).status_code == 422
    assert client.patch(f"/api/leads/{lid}", json={"decision": "maybe"}, headers=ADMIN).status_code == 422


def test_reviewed_lead_is_final():
    lid = propose().json()["id"]
    r = client.patch(f"/api/leads/{lid}", json={"decision": "accepted", "queueDate": "2026-10-15"}, headers=ADMIN)
    assert r.status_code == 200
    assert r.json()["status"] == "accepted" and r.json()["queueDate"] == "2026-10-15"
    again = client.patch(f"/api/leads/{lid}", json={"decision": "rejected", "reviewNote": "x"}, headers=ADMIN)
    assert again.status_code == 409


def test_accept_does_not_write_the_queue():
    lid = propose().json()["id"]
    client.patch(f"/api/leads/{lid}", json={"decision": "accepted", "queueDate": "2026-10-15"}, headers=ADMIN)
    assert client.get("/api/to_apply", headers=ADMIN).json()["rows"] == []


def test_every_lead_write_is_shadowed():
    lid = propose().json()["id"]
    client.patch(f"/api/leads/{lid}", json={"decision": "rejected", "reviewNote": "closed"}, headers=ADMIN)
    with main.SessionLocal() as s:
        ops = [h.op for h in s.query(main.ShadowHistory).filter_by(kind="job_lead", key=str(lid))]
    assert ops == ["put", "patch"]


# ---- connectors: the proposer can never approve ----------------------------

def _tool_names(server):
    async def go():
        async with Client(server) as c:
            return {t.name for t in await c.list_tools()}

    return asyncio.run(go())


def test_submit_connector_can_propose_but_not_list_or_review():
    names = _tool_names(main.submit_mcp)
    assert "propose_job_lead" in names
    assert "list_job_leads" not in names and "review_job_lead" not in names
    assert "put_to_apply_queue" not in names
    assert len(names) == 7


def test_sourcing_connector_can_list_and_review_but_not_propose():
    names = _tool_names(main.mcp)
    assert {"list_job_leads", "review_job_lead"} <= names
    assert "propose_job_lead" not in names


def test_full_flow_through_both_connectors():
    async def go():
        async with Client(main.submit_mcp) as sub:
            res = await sub.call_tool("propose_job_lead", {"apply_url": URL, "found_via": "email"})
            lid = res.structured_content["id"]
            dup = await sub.call_tool("propose_job_lead", {"apply_url": URL})
            assert dup.structured_content["error"].startswith("409")
        async with Client(main.mcp) as src:
            leads = (await src.call_tool("list_job_leads", {})).structured_content["result"]
            assert [x["id"] for x in leads] == [lid]
            day = date.today().isoformat()
            await src.call_tool("put_to_apply_queue", {
                "queue_date": day,
                "rows": [{"company": "Acme", "role": "SWE", "applyUrl": URL, "note": f"lead #{lid} (email)"}],
            })
            done = await src.call_tool("review_job_lead", {"lead_id": lid, "decision": "accepted", "queue_date": day})
            assert done.structured_content["status"] == "accepted"
        async with Client(main.submit_mcp) as sub:
            q = (await sub.call_tool("get_to_apply_queue", {})).structured_content
            assert [r["applyUrl"] for r in q["rows"]] == [URL]

    asyncio.run(go())
