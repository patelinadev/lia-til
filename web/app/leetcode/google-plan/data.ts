// Static content for the public 14-day Google Round 1 prep plan (/leetcode/google-plan).
// Plain data, no backend: edit here and redeploy to change the plan.

// Day 1 of the plan, as YYYY-MM-DD. Every other date on the calendar is derived from it.
export const START_DATE = "2026-11-07";

export type Problem = { num: number; title: string };

export type PlanDay = {
  day: number;
  topic: string;
  mock?: number; // mentor mock number on this day
  buffer?: boolean; // review / slack day
  problems?: Problem[];
  note?: string; // shown instead of problems on non-topic days
};

export const DAYS: PlanDay[] = [
  {
    day: 1,
    topic: "Python for interviews + arrays and hashing",
    problems: [
      { num: 1, title: "Two Sum" },
      { num: 49, title: "Group Anagrams" },
      { num: 347, title: "Top K Frequent Elements" },
      { num: 128, title: "Longest Consecutive Sequence" },
    ],
  },
  {
    day: 2,
    topic: "Two pointers + sliding window",
    problems: [
      { num: 15, title: "3Sum" },
      { num: 11, title: "Container With Most Water" },
      { num: 3, title: "Longest Substring Without Repeating Characters" },
      { num: 76, title: "Minimum Window Substring" },
    ],
  },
  {
    day: 3,
    topic: "Stack, monotonic stack, prefix sum",
    mock: 1,
    problems: [
      { num: 20, title: "Valid Parentheses" },
      { num: 739, title: "Daily Temperatures" },
      { num: 560, title: "Subarray Sum Equals K" },
      { num: 84, title: "Largest Rectangle in Histogram" },
    ],
  },
  {
    day: 4,
    topic: "Binary search (including searching on the answer) + intervals",
    problems: [
      { num: 33, title: "Search in Rotated Sorted Array" },
      { num: 875, title: "Koko Eating Bananas" },
      { num: 56, title: "Merge Intervals" },
      { num: 253, title: "Meeting Rooms II" },
    ],
  },
  {
    day: 5,
    topic: "Trees: DFS, BFS, BST",
    problems: [
      { num: 102, title: "Binary Tree Level Order Traversal" },
      { num: 98, title: "Validate Binary Search Tree" },
      { num: 236, title: "Lowest Common Ancestor of a Binary Tree" },
      { num: 543, title: "Diameter of Binary Tree" },
      { num: 297, title: "Serialize and Deserialize Binary Tree" },
    ],
  },
  {
    day: 6,
    topic: "Heaps / top-k + review of days 1–5",
    mock: 2,
    buffer: true,
    problems: [
      { num: 215, title: "Kth Largest Element in an Array" },
      { num: 23, title: "Merge k Sorted Lists" },
      { num: 295, title: "Find Median from Data Stream" },
    ],
  },
  {
    day: 7,
    topic: "Graphs I: grid BFS/DFS, topological sort",
    problems: [
      { num: 200, title: "Number of Islands" },
      { num: 994, title: "Rotting Oranges" },
      { num: 207, title: "Course Schedule" },
      { num: 210, title: "Course Schedule II" },
    ],
  },
  {
    day: 8,
    topic: "Graphs II: union-find, Dijkstra",
    problems: [
      { num: 684, title: "Redundant Connection" },
      { num: 721, title: "Accounts Merge" },
      { num: 743, title: "Network Delay Time" },
    ],
  },
  {
    day: 9,
    topic: "Backtracking",
    mock: 3,
    problems: [
      { num: 78, title: "Subsets" },
      { num: 46, title: "Permutations" },
      { num: 39, title: "Combination Sum" },
      { num: 79, title: "Word Search" },
    ],
  },
  {
    day: 10,
    topic: "DP I: 1D, knapsack",
    problems: [
      { num: 70, title: "Climbing Stairs" },
      { num: 198, title: "House Robber" },
      { num: 322, title: "Coin Change" },
      { num: 300, title: "Longest Increasing Subsequence" },
      { num: 139, title: "Word Break" },
    ],
  },
  {
    day: 11,
    topic: "DP II: 2D grids and strings",
    problems: [
      { num: 62, title: "Unique Paths" },
      { num: 1143, title: "Longest Common Subsequence" },
      { num: 72, title: "Edit Distance" },
      { num: 5, title: "Longest Palindromic Substring" },
    ],
  },
  {
    day: 12,
    topic: "Trie + class-design coding",
    mock: 4,
    problems: [
      { num: 208, title: "Implement Trie (Prefix Tree)" },
      { num: 212, title: "Word Search II" },
      { num: 146, title: "LRU Cache" },
      { num: 362, title: "Design Hit Counter" },
    ],
  },
  {
    day: 13,
    topic: "Full simulations",
    buffer: true,
    note: "3 random Google questions, 45 min each, back to back. Then fix your 2 weakest topics.",
  },
  {
    day: 14,
    topic: "Light day",
    buffer: true,
    note: "Reread your mistake log and templates. No new problems, sleep early. Test your setup and practice a 60-second intro.",
  },
];

export const PYTHON_ESSENTIALS: { code: string; note?: string }[] = [
  { code: "from collections import defaultdict, Counter, deque" },
  { code: "import heapq", note: "it's a min-heap. For a max-heap, push -x" },
  { code: "from bisect import bisect_left · from functools import cache" },
  { code: "sorted(arr, key=lambda x: (x[1], -x[0])) · enumerate · zip" },
  { code: "''.join(chars) · float('inf')" },
  { code: "[[0]*n for _ in range(m)]", note: "never [[0]*n]*m: the rows end up being the same list" },
];

export const TALK_FLOW = [
  "Clarify + edge cases",
  "Small example by hand",
  "Brute force + complexity",
  "Optimize",
  "Get the interviewer's OK",
  "Code",
  "Trace the example",
  "Time / space",
];
