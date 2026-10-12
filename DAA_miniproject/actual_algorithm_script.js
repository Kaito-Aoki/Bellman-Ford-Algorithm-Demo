/*
 * Bellman–Ford execution engine used by the TravelPath application.
 * This file has no DOM, SVG, timer, or UI dependencies. It records a complete
 * immutable distance/predecessor snapshot after every meaningful operation.
 */
function bellmanFordExecution(vertices, edges, sourceCity, destinationCity) {
    const distances = {};
    const previousCity = {};
    const events = [];

    function snapshotState() {
        const distanceSnapshot = {};
        const predecessorSnapshot = {};
        for (let index = 0; index < vertices.length; index += 1) {
            const city = vertices[index];
            distanceSnapshot[city] = distances[city];
            predecessorSnapshot[city] = previousCity[city];
        }
        return { distances: distanceSnapshot, previousCity: predecessorSnapshot };
    }

    function record(type, details) {
        const event = Object.assign({
            index: events.length,
            type: type,
            iteration: 0,
            from: null,
            to: null,
            weight: null,
            currentCity: null,
            candidateDistance: null,
            oldDistance: null,
            newDistance: null,
            changed: false,
            detected: false,
            status: null,
            message: ""
        }, details || {}, snapshotState());
        events.push(event);
    }

    // 1. Initialize every vertex, then make the chosen source reachable at cost 0.
    for (let vertexIndex = 0; vertexIndex < vertices.length; vertexIndex += 1) {
        distances[vertices[vertexIndex]] = Infinity;
        previousCity[vertices[vertexIndex]] = null;
    }
    if (distances[sourceCity] === undefined) {
        distances[sourceCity] = Infinity;
        previousCity[sourceCity] = null;
    }
    if (distances[destinationCity] === undefined) {
        distances[destinationCity] = Infinity;
        previousCity[destinationCity] = null;
    }
    distances[sourceCity] = 0;
    record("initialize", {
        currentCity: sourceCity,
        message: "Initialize distances: " + sourceCity + " is 0; every other city is ∞."
    });

    // 2. Relax every directed edge on up to V - 1 passes, stopping when stable.
    let iterationsPerformed = 0;
    let stoppedEarly = false;
    for (let iteration = 1; iteration <= vertices.length - 1; iteration += 1) {
        iterationsPerformed += 1;
        let changedThisIteration = false;
        record("iteration-start", {
            iteration: iteration,
            message: "Iteration " + iteration + " begins. Check each directed edge for a cheaper route."
        });

        for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
            const edge = edges[edgeIndex];
            const shared = {
                iteration: iteration,
                from: edge.from,
                to: edge.to,
                weight: edge.weight,
                currentCity: edge.to
            };
            record("edge-selected", Object.assign({}, shared, {
                message: "Iteration " + iteration + ": select edge " + edge.from + " → " + edge.to + " (weight " + edge.weight + ")."
            }));

            const sourceDistance = distances[edge.from];
            if (sourceDistance === Infinity || sourceDistance === undefined) {
                record("reachability-check", Object.assign({}, shared, {
                    oldDistance: distances[edge.to],
                    message: edge.from + " is unreachable so far; this edge cannot update " + edge.to + "."
                }));
                record("edge-skipped", Object.assign({}, shared, {
                    oldDistance: distances[edge.to],
                    message: "Skip " + edge.from + " → " + edge.to + ": the starting city has distance ∞."
                }));
                continue;
            }

            record("reachability-check", Object.assign({}, shared, {
                oldDistance: distances[edge.to],
                message: edge.from + " is reachable at " + sourceDistance + "; this edge can be checked."
            }));
            const candidateDistance = sourceDistance + edge.weight;
            record("candidate-calculated", Object.assign({}, shared, {
                candidateDistance: candidateDistance,
                oldDistance: distances[edge.to],
                message: "Candidate distance is " + sourceDistance + " + " + edge.weight + " = " + candidateDistance + "."
            }));

            const oldDistance = distances[edge.to];
            const isImprovement = candidateDistance < oldDistance;
            record("distance-compared", Object.assign({}, shared, {
                candidateDistance: candidateDistance,
                oldDistance: oldDistance,
                changed: isImprovement,
                message: isImprovement
                    ? "Compare " + candidateDistance + " with " + (oldDistance === Infinity ? "∞" : oldDistance) + ": the candidate is lower."
                    : "Compare " + candidateDistance + " with " + (oldDistance === Infinity ? "∞" : oldDistance) + ": keep the recorded distance."
            }));

            if (isImprovement) {
                distances[edge.to] = candidateDistance;
                previousCity[edge.to] = edge.from;
                changedThisIteration = true;
                record("distance-updated", Object.assign({}, shared, {
                    candidateDistance: candidateDistance,
                    oldDistance: oldDistance,
                    newDistance: candidateDistance,
                    changed: true,
                    message: "Update " + edge.to + " from " + (oldDistance === Infinity ? "∞" : oldDistance) + " to " + candidateDistance + "; previous city is " + edge.from + "."
                }));
            } else {
                record("distance-kept", Object.assign({}, shared, {
                    candidateDistance: candidateDistance,
                    oldDistance: oldDistance,
                    newDistance: oldDistance,
                    message: "Keep " + edge.to + " at " + (oldDistance === Infinity ? "∞" : oldDistance) + "; this edge does not improve it."
                }));
            }
        }

        record("iteration-end", {
            iteration: iteration,
            changed: changedThisIteration,
            message: changedThisIteration
                ? "Iteration " + iteration + " ends with at least one distance update."
                : "Iteration " + iteration + " ends with no distance updates."
        });
        if (changedThisIteration === false) {
            stoppedEarly = true;
            record("early-stop", {
                iteration: iteration,
                message: "Stop early: no distance changed in this full iteration."
            });
            break;
        }
    }

    // 3. A reachable edge that can still improve proves a reachable negative cycle.
    record("cycle-check-start", { message: "Check reachable edges once more for a negative-weight cycle." });
    let hasNegativeCycle = false;
    let negativeCycleEdge = null;
    for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
        const edge = edges[edgeIndex];
        const shared = {
            from: edge.from,
            to: edge.to,
            weight: edge.weight,
            currentCity: edge.to
        };
        record("cycle-edge-selected", Object.assign({}, shared, {
            message: "Cycle check: inspect " + edge.from + " → " + edge.to + "."
        }));
        const sourceDistance = distances[edge.from];
        if (sourceDistance === Infinity || sourceDistance === undefined) {
            record("cycle-edge-result", Object.assign({}, shared, {
                oldDistance: distances[edge.to],
                message: "Skip this cycle check because " + edge.from + " is unreachable from the source."
            }));
            continue;
        }
        const candidateDistance = sourceDistance + edge.weight;
        const oldDistance = distances[edge.to];
        record("cycle-edge-result", Object.assign({}, shared, {
            candidateDistance: candidateDistance,
            oldDistance: oldDistance,
            detected: candidateDistance < oldDistance,
            message: candidateDistance < oldDistance
                ? "A reachable edge can still lower " + edge.to + " (" + candidateDistance + " < " + oldDistance + ")."
                : "No further improvement on this reachable edge."
        }));
        if (candidateDistance < oldDistance) {
            hasNegativeCycle = true;
            negativeCycleEdge = edge;
            record("negative-cycle-detected", Object.assign({}, shared, {
                candidateDistance: candidateDistance,
                oldDistance: oldDistance,
                detected: true,
                message: "Reachable negative-weight cycle detected through " + edge.from + " → " + edge.to + "."
            }));
            break;
        }
    }
    if (hasNegativeCycle === false) {
        record("negative-cycle-clear", {
            message: "Cycle check complete: no reachable negative-weight cycle was found."
        });
    }

    // 4. Reconstruct the route by following predecessor links backwards.
    let status = "ok";
    let shortestPath = [];
    let totalCost = null;
    if (hasNegativeCycle) {
        status = "negative-cycle";
        record("route-unavailable", {
            currentCity: destinationCity,
            status: status,
            message: "A finite shortest route is undefined because a reachable negative cycle exists."
        });
    } else if (distances[destinationCity] === Infinity || distances[destinationCity] === undefined) {
        status = "unreachable";
        record("route-unavailable", {
            currentCity: destinationCity,
            status: status,
            message: destinationCity + " is unreachable from " + sourceCity + "."
        });
    } else {
        record("reconstruction-start", {
            currentCity: destinationCity,
            message: "Reconstruct the route by following predecessor links backward from " + destinationCity + "."
        });
        let currentCity = destinationCity;
        let steps = 0;
        while (currentCity !== null && currentCity !== undefined && steps <= vertices.length) {
            shortestPath.push(currentCity);
            record("path-step", {
                currentCity: currentCity,
                from: previousCity[currentCity],
                to: currentCity,
                message: previousCity[currentCity] === null
                    ? "Reach the source city " + currentCity + "."
                    : "Follow predecessor " + previousCity[currentCity] + " back from " + currentCity + "."
            });
            if (currentCity === sourceCity) {
                break;
            }
            currentCity = previousCity[currentCity];
            steps += 1;
        }
        if (shortestPath[shortestPath.length - 1] !== sourceCity) {
            status = "unreachable";
            shortestPath = [];
        } else {
            shortestPath.reverse();
            totalCost = distances[destinationCity];
            record("route-reconstructed", {
                currentCity: destinationCity,
                status: "ok",
                message: "Route reconstructed: " + shortestPath.join(" → ") + " (cost " + totalCost + ")."
            });
        }
    }

    record("complete", {
        currentCity: destinationCity,
        status: status,
        detected: hasNegativeCycle,
        message: status === "ok"
            ? "Bellman–Ford is complete. The shortest route costs " + totalCost + "."
            : (status === "negative-cycle" ? "Bellman–Ford is complete; no finite shortest route exists." : "Bellman–Ford is complete; the destination cannot be reached.")
    });

    return {
        status: status,
        shortestPath: shortestPath,
        totalCost: totalCost,
        distances: snapshotState().distances,
        previousCity: snapshotState().previousCity,
        hasNegativeCycle: hasNegativeCycle,
        negativeCycleEdge: negativeCycleEdge,
        iterationsPerformed: iterationsPerformed,
        stoppedEarly: stoppedEarly,
        events: events
    };
}
