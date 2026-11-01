"""One URL, one state: once a posting has an App#, no queue row for it — on any
day — stays queued. (Rokt: App#442 was minted from 10-30's row while 10-31's row
for the same URL still showed as unapplied in Bridge.)"""

from fastapi.testclient import TestClient

import main

ADMIN = {"x-admin-secret": "test-admin-secret"}
client = TestClient(main.app)

URL = "https://builtin.com/job/junior-software-engineer-rokt-residency/11822103"


def put_queue(day, *urls):
    r = client.put(
        "/api/to_apply",
        json={"queueDate": day, "rows": [{"company": "Rokt", "role": "Junior SWE", "applyUrl": u} for u in urls]},
        headers=ADMIN,
    )
    assert r.status_code == 200, r.text


def rows(day):
    r = client.get("/api/to_apply", params={"date": day}, headers=ADMIN)
    assert r.status_code == 200, r.text
    return {row["applyUrl"]: row for row in r.json()["rows"]}


def apply(row_id):
    return client.post(f"/api/to_apply/{row_id}/apply", json={}, headers=ADMIN)


def test_applying_one_day_settles_the_same_url_on_other_days():
    put_queue("2026-10-30", URL)
    put_queue("2026-10-31", URL, "https://example.com/other")
    r = apply(rows("2026-10-30")[URL]["id"])
    assert r.status_code == 200, r.text
    app_num = r.json()["appNum"]

    today = rows("2026-10-31")
    assert today[URL]["status"] == "applied"
    assert today[URL]["appNum"] == app_num
    assert today["https://example.com/other"]["status"] == "queued"
    assert today["https://example.com/other"]["appNum"] is None


def test_requeueing_an_applied_url_lands_as_applied():
    put_queue("2026-10-30", URL)
    app_num = apply(rows("2026-10-30")[URL]["id"]).json()["appNum"]

    put_queue("2026-10-31", URL)
    row = rows("2026-10-31")[URL]
    assert row["status"] == "applied"
    assert row["appNum"] == app_num


def test_skipped_row_is_left_alone():
    put_queue("2026-10-30", URL)
    put_queue("2026-10-31", URL)
    today_id = rows("2026-10-31")[URL]["id"]
    client.patch(f"/api/to_apply/{today_id}", json={"status": "skipped"}, headers=ADMIN)

    apply(rows("2026-10-30")[URL]["id"])
    row = rows("2026-10-31")[URL]
    assert row["status"] == "skipped"  # the operator's choice stands; appNum still says why
    assert row["appNum"] is not None


def test_duplicate_apply_still_settles_a_leftover_queued_row():
    put_queue("2026-10-30", URL)
    app_num = apply(rows("2026-10-30")[URL]["id"]).json()["appNum"]
    # A row that predates the rule: force it back to queued.
    put_queue("2026-10-31", URL)
    today_id = rows("2026-10-31")[URL]["id"]
    client.patch(f"/api/to_apply/{today_id}", json={"status": "queued"}, headers=ADMIN)

    r = apply(today_id)
    assert r.status_code == 409
    assert r.json()["detail"]["existingAppNum"] == app_num
    assert rows("2026-10-31")[URL]["status"] == "applied"
