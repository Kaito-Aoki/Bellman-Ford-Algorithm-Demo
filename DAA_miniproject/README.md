# TravelPath — Bellman–Ford Travel Planner

TravelPath is an offline browser-based DAA mini-project. It calculates a minimum-cost route between Gujarat cities with Bellman–Ford, then replays the algorithm's real operations against a large, zoomable city network. Sample route costs are fictional demonstration values, not live fares.

## Run the project

1. Keep `index.html`, `style.css`, `app.js`, `algorithm.js`, and `actual_algorithm_script.js` in the same folder.
2. Open `index.html` in a modern browser. No installation, server, framework, API, or internet connection is required.
3. Choose a source and destination, then click **Find best route**. That click creates and starts the execution trace; the final route appears when playback reaches completion.
4. Use **Play / Resume**, **Pause**, **Previous**, **Next step**, **Restart**, or **Run to end**. The speed slider snaps to `0.25×`, `0.5×`, `1×`, `5×`, `10×`, or `20×`; speed changes apply to the running timer immediately.
5. Zoom the network with `+` / `−` or the mouse wheel, drag to pan, and click **Reset** to restore the original view. Add or edit a two-way route with a non-negative cost, then calculate again.
6. Open `tests.html` to run the offline browser test suite.

The app keeps its sample network and route editor available offline. The network is intentionally displayed before calculation, while shortest-route and execution highlights appear only after **Find best route** is clicked.

## Files and responsibilities

- `index.html` — page structure, distance table, playback controls, operation panel, and event timeline.
- `style.css` — responsive layout, readable expanded network, table and timeline states, and graph effects.
- `algorithm.js` — the simple educational reference implementation for learning and viva explanation. It has no UI, timer, SVG, or trace machinery.
- `actual_algorithm_script.js` — the independent Bellman–Ford implementation used by the app. It calculates the result and records per-event state snapshots without accessing the UI.
- `app.js` — sample network, route editing, SVG rendering, table/timeline rendering, and playback controller. The controller replays saved snapshots and does not calculate algorithm states.
- `tests.html` — offline browser tests comparing both implementations and checking trace history and playback behavior.
- `project-report.md` — the undergraduate project report.

## The two Bellman–Ford implementations

### Learning version: `algorithm.js`

`bellmanFord(vertices, edges, sourceCity, destinationCity)` is written to keep the core idea visible: initialize distances and predecessors, run nested `for` loops to relax edges up to `V - 1` times, stop when a pass makes no change, scan reachable edges for a negative cycle, and reconstruct the route by following predecessors. It returns `status`, `shortestPath`, `totalCost`, `distances`, `previousCity`, `hasNegativeCycle`, and `iterationsPerformed`.

This function is a standalone reference for explaining Bellman–Ford. It does not drive the animation.

### Application engine: `actual_algorithm_script.js`

`bellmanFordExecution(vertices, edges, sourceCity, destinationCity)` independently runs the same Bellman–Ford algorithm. Alongside its final result, it creates an ordered `events` array. Events record initialization, iteration starts and ends, each edge selection, reachability checks, candidate calculations, comparisons, distance updates or keeps, early termination, the negative-cycle scan, predecessor traversal, and completion.

Every event includes the relevant iteration and edge details plus copies of the distance and predecessor maps after that operation. This makes the history reversible: moving the cursor backward reads the earlier snapshot rather than trying to undo arithmetic. The app uses the same saved event for its current-operation explanation, graph highlights, live table, progress count, and timeline. `app.js` never computes a second set of Bellman–Ford states.

The two implementations are intentionally separate but tested against the same cases. They must agree on final distances, route, cost, and reachable negative-cycle detection.

## Reading the visualizer

- **Network:** Edge labels show the fictional route cost. An amber moving edge is being examined; orange marks a successful distance improvement; green links show current predecessors; the final route receives its own highlight after the completion event. Nodes show the current source/destination and live distance labels during playback.
- **Distance table:** One row per city shows the current best known distance and its predecessor. Initially, the selected source is `0`, all other cities are `∞`, and no predecessor exists. The current city is highlighted; known distances and the latest improvement have distinct styling. Moving backward restores the table from that event's snapshot.
- **Current operation:** Plain-language text is built from the current recorded event, including the real city IDs and costs used by the algorithm.
- **Timeline:** Each event appears in execution order. Past, current, and upcoming events have separate states. Every playback action moves the timeline and graph/table to the same event index.
- **Controls:** Pause clears the pending timer but preserves the event cursor. Resume schedules one timer from that position. Manual stepping works while paused. Changing speed replaces the pending timer while keeping the cursor, so it does not alter the computed result.

The normal travel planner accepts non-negative costs. The algorithm implementations also accept negative edges for tests or demonstrations. A reachable negative-weight cycle makes a finite shortest route undefined; an unreachable negative cycle does not affect the selected source. An unreachable destination has no route, and when source equals destination the route contains just that city with cost zero.

## Bellman–Ford pseudocode

```text
for each city:
    distance[city] = Infinity
    previous[city] = none
distance[source] = 0

repeat at most V - 1 times:
    changed = false
    for each directed edge (u, v, weight):
        if distance[u] is finite and distance[u] + weight < distance[v]:
            distance[v] = distance[u] + weight
            previous[v] = u
            changed = true
    if changed is false:
        stop early

for each directed edge (u, v, weight):
    if distance[u] is finite and distance[u] + weight < distance[v]:
        report a reachable negative cycle

if destination is reachable and no negative cycle was found:
    follow previous links from destination to source
    reverse the collected cities
```

## Complexity

The relaxation phase checks `E` directed edges in up to `V - 1` passes, followed by one edge scan for negative-cycle detection. The Bellman–Ford calculation takes **O(VE)** time. The learning implementation's distance, predecessor, and path data use **O(V)** auxiliary space. The application trace has **O(VE)** events in the worst case and stores a full **O(V)** snapshot per event, so snapshots can use **O(V²E)** space. Copying those snapshots also adds **O(V²E)** trace-recording work in the worst case; the algorithm's underlying distance calculation remains **O(VE)**. This deliberately favors reliable rewind and clarity for the small demonstration graph.

## Viva practice

**Q: What does relaxing an edge mean?**  
A: Compare the current best distance to its start plus the edge weight with the recorded distance to its end. If the candidate is lower, save it and record the start as predecessor.

**Q: Why can Bellman–Ford handle negative edges?**  
A: It revisits every edge across multiple passes, so a negative edge can improve a distance after an earlier route was found.

**Q: Why are `V - 1` passes enough?**  
A: A shortest route without a cycle can use at most `V - 1` edges. Each pass can extend a known route by another edge.

**Q: Why scan once more after those passes?**  
A: Any further improvement from a reachable vertex means a reachable negative-weight cycle can keep reducing costs.

**Q: What does `previousCity` store?**  
A: The city immediately before a reached city on the best route found so far. Following these links backward rebuilds the route.

**Q: Why does a bidirectional connection become two edges?**  
A: Bellman–Ford processes directed edges, so a two-way road is represented by one edge in each direction with the same cost.

**Q: What is stored in the event history?**  
A: The operation type, edge and iteration details, explanation, and distance/predecessor snapshots. The UI can replay or restore the exact state at any event.

**Q: What are the time and space complexities?**  
A: Bellman–Ford runs in `O(VE)` time. Core learning state is `O(V)`; the app's full history snapshots can require `O(V²E)` space.
