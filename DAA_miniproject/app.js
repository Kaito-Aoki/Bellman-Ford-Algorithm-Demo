/* Playback controller lives in the UI layer. Injected timer functions make it
 * deterministic to exercise in tests without coupling it to the algorithm. */
function createPlaybackController(options) {
    const allowedSpeeds = [0.25, 0.5, 1, 5, 10, 20];
    const settings = options || {};
    const getEventCount = settings.getEventCount || function () { return 0; };
    const onStep = settings.onStep || function () {};
    const schedule = settings.schedule || function (callback, delay) { return window.setTimeout(callback, delay); };
    const cancel = settings.cancel || function (timerId) { window.clearTimeout(timerId); };
    let cursor = -1;
    let playing = false;
    let timerId = null;
    let speed = 1;

    function clearTimer() {
        if (timerId !== null) {
            cancel(timerId);
            timerId = null;
        }
    }

    function scheduleNext() {
        clearTimer();
        if (playing && cursor < getEventCount() - 1) {
            timerId = schedule(function () {
                timerId = null;
                if (playing) {
                    advanceOne();
                    scheduleNext();
                }
            }, 600 / speed);
        }
    }

    function advanceOne() {
        const eventCount = getEventCount();
        if (cursor + 1 >= eventCount) {
            playing = false;
            clearTimer();
            return false;
        }
        cursor += 1;
        onStep(cursor);
        if (cursor >= eventCount - 1) {
            playing = false;
            clearTimer();
        }
        return true;
    }

    return {
        play: function () {
            if (getEventCount() === 0) { return; }
            if (cursor >= getEventCount() - 1) {
                cursor = -1;
                onStep(cursor);
            }
            if (playing) { return; }
            playing = true;
            if (cursor < 0) { advanceOne(); }
            if (playing) { scheduleNext(); }
        },
        pause: function () {
            playing = false;
            clearTimer();
        },
        next: function () {
            playing = false;
            clearTimer();
            advanceOne();
        },
        previous: function () {
            playing = false;
            clearTimer();
            cursor = Math.max(-1, cursor - 1);
            onStep(cursor);
        },
        restart: function () {
            playing = false;
            clearTimer();
            cursor = -1;
            onStep(cursor);
        },
        runToEnd: function () {
            playing = false;
            clearTimer();
            cursor = getEventCount() - 1;
            onStep(cursor);
        },
        setSpeed: function (newSpeed) {
            const numericSpeed = Number(newSpeed);
            if (!Number.isFinite(numericSpeed)) { return speed; }
            speed = allowedSpeeds.reduce(function (closestSpeed, candidateSpeed) {
                return Math.abs(candidateSpeed - numericSpeed) < Math.abs(closestSpeed - numericSpeed) ? candidateSpeed : closestSpeed;
            }, allowedSpeeds[0]);
            if (playing) { scheduleNext(); }
            return speed;
        },
        getCursor: function () { return cursor; },
        getSpeed: function () { return speed; },
        isPlaying: function () { return playing; },
        dispose: function () {
            playing = false;
            clearTimer();
        }
    };
}

/* Build each calculation from one captured selection and graph snapshot.
 * The returned run is the single source of truth for its trace and playback. */
function createTravelPathRun(vertices, connections, sourceCity, destinationCity) {
    const cityIds = vertices.slice();
    const graphConnections = connections.map(function (connection) {
        return { from: connection.from, to: connection.to, cost: connection.cost };
    });
    const directedEdges = [];
    graphConnections.forEach(function (connection) {
        directedEdges.push({ from: connection.from, to: connection.to, weight: connection.cost });
        directedEdges.push({ from: connection.to, to: connection.from, weight: connection.cost });
    });
    // Put edges leaving the selected source first so the animation begins at that city.
    const sourceEdges = directedEdges.filter(function (edge) { return edge.from === sourceCity; });
    const remainingEdges = directedEdges.filter(function (edge) { return edge.from !== sourceCity; });
    const executionEdges = sourceEdges.concat(remainingEdges);
    return {
        sourceCity: sourceCity,
        destinationCity: destinationCity,
        vertices: cityIds,
        connections: graphConnections,
        directedEdges: executionEdges,
        result: bellmanFordExecution(cityIds, executionEdges, sourceCity, destinationCity)
    };
}

if (typeof document !== "undefined" && document.getElementById("source-city")) {
    const playbackSpeedStops = [0.25, 0.5, 1, 5, 10, 20];
    const cities = [
        { id: "ahmedabad", name: "Ahmedabad", x: 340, y: 150 },
        { id: "gandhinagar", name: "Gandhinagar", x: 430, y: 90 },
        { id: "anand", name: "Anand", x: 500, y: 190 },
        { id: "nadiad", name: "Nadiad", x: 435, y: 250 },
        { id: "vadodara", name: "Vadodara", x: 590, y: 280 },
        { id: "bharuch", name: "Bharuch", x: 655, y: 355 },
        { id: "surat", name: "Surat", x: 530, y: 385 },
        { id: "rajkot", name: "Rajkot", x: 90, y: 270 },
        { id: "bhavnagar", name: "Bhavnagar", x: 270, y: 350 }
    ];

    // Each sample connection becomes two directed edges for Bellman–Ford.
    let connections = [
        { from: "ahmedabad", to: "gandhinagar", cost: 90 },
        { from: "ahmedabad", to: "anand", cost: 180 },
        { from: "ahmedabad", to: "nadiad", cost: 160 },
        { from: "ahmedabad", to: "rajkot", cost: 420 },
        { from: "ahmedabad", to: "bhavnagar", cost: 360 },
        { from: "gandhinagar", to: "anand", cost: 210 },
        { from: "anand", to: "nadiad", cost: 70 },
        { from: "anand", to: "vadodara", cost: 150 },
        { from: "nadiad", to: "vadodara", cost: 120 },
        { from: "rajkot", to: "bhavnagar", cost: 240 },
        { from: "bhavnagar", to: "surat", cost: 330 },
        { from: "vadodara", to: "bharuch", cost: 130 },
        { from: "vadodara", to: "surat", cost: 240 },
        { from: "bharuch", to: "surat", cost: 140 }
    ];

    const byId = function (id) { return document.getElementById(id); };
    const sourceSelect = byId("source-city");
    const destinationSelect = byId("destination-city");
    const routeFromSelect = byId("route-from");
    const routeToSelect = byId("route-to");
    const routeResult = byId("route-result");
    const resultTitle = byId("result-title");
    const totalCost = byId("total-cost");
    const routeSummary = byId("route-summary");
    const iterationsSummary = byId("iterations-summary");
    const graphEdges = byId("graph-edges");
    const graphNodes = byId("graph-nodes");
    const graphViewport = byId("graph-viewport");
    const graphElement = byId("city-graph");
    const graphProgress = byId("algorithm-progress");
    const distanceTableBody = byId("distance-table-body");
    const executionTimeline = byId("execution-log");
    const logCount = byId("log-count");
    const operationTitle = byId("operation-title");
    const operationExplanation = byId("operation-explanation");
    const playbackProgress = byId("playback-progress");
    const addRouteMessage = byId("add-route-message");
    const speedSlider = byId("speed-slider");
    const speedOutput = byId("speed-output");
    const zoomLevel = byId("zoom-level");
    const playbackButtons = ["play-pause", "pause", "next-step", "previous-step", "restart", "run-to-end"];

    let activeRun = null;
    let playback = null;
    let timelineItems = [];
    let graphScale = 1;
    let graphTranslateX = 0;
    let graphTranslateY = 0;
    let panPointer = null;

    function getCityName(cityId) {
        const city = cities.find(function (item) { return item.id === cityId; });
        return city ? city.name : cityId;
    }

    function fillCitySelect(selectElement, selectedCity) {
        selectElement.textContent = "";
        cities.forEach(function (city) {
            const option = document.createElement("option");
            option.value = city.id;
            option.textContent = city.name;
            option.selected = city.id === selectedCity;
            selectElement.appendChild(option);
        });
    }

    function pathContainsConnection(path, firstCity, secondCity) {
        for (let index = 0; index < path.length - 1; index += 1) {
            if ((path[index] === firstCity && path[index + 1] === secondCity) ||
                (path[index] === secondCity && path[index + 1] === firstCity)) { return true; }
        }
        return false;
    }

    function formatDistance(distance) {
        if (distance === Infinity || distance === undefined || distance === null) { return "∞"; }
        return "₹" + Number(distance).toLocaleString("en-IN");
    }

    function selectedPlaybackSpeed() {
        const stopIndex = Math.min(playbackSpeedStops.length - 1, Math.max(0, Math.round(Number(speedSlider.value))));
        return playbackSpeedStops[stopIndex];
    }

    function formatPlaybackSpeed(speed) {
        return String(speed) + "×";
    }

    function formatEventMessage(message) {
        let readable = message;
        cities.forEach(function (city) {
            readable = readable.replace(new RegExp("\\b" + city.id + "\\b", "gi"), city.name);
        });
        return readable;
    }

    function renderGraph(run, event, distances, selectedCities) {
        const sourceCity = run ? run.sourceCity : (selectedCities ? selectedCities.sourceCity : sourceSelect.value);
        const destinationCity = run ? run.destinationCity : (selectedCities ? selectedCities.destinationCity : destinationSelect.value);
        const graphConnections = run ? run.connections : connections;
        const completed = event && event.type === "complete";
        const highlightedPath = completed && run && run.result.status === "ok" ? run.result.shortestPath : [];
        const activeEdge = event && event.from !== null && event.to !== null &&
            ["edge-selected", "reachability-check", "candidate-calculated", "distance-compared", "distance-updated", "distance-kept", "edge-skipped", "cycle-edge-selected", "cycle-edge-result", "negative-cycle-detected"].indexOf(event.type) !== -1;
        const predecessorMap = event ? event.previousCity : {};
        graphEdges.textContent = "";
        graphNodes.textContent = "";

        graphConnections.forEach(function (connection) {
            const fromCity = cities.find(function (city) { return city.id === connection.from; });
            const toCity = cities.find(function (city) { return city.id === connection.to; });
            const onFinalPath = pathContainsConnection(highlightedPath, connection.from, connection.to);
            const isPredecessor = predecessorMap[connection.from] === connection.to || predecessorMap[connection.to] === connection.from;
            const isCurrentEdge = activeEdge && ((event.from === connection.from && event.to === connection.to) || (event.from === connection.to && event.to === connection.from));
            const midpointX = (fromCity.x + toCity.x) / 2;
            const midpointY = (fromCity.y + toCity.y) / 2;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", fromCity.x); line.setAttribute("y1", fromCity.y);
            line.setAttribute("x2", toCity.x); line.setAttribute("y2", toCity.y);
            let classes = "edge-line";
            if (isPredecessor && !onFinalPath) { classes += " edge-predecessor"; }
            if (onFinalPath) { classes += " edge-highlight"; }
            if (isCurrentEdge) {
                classes += event.type === "negative-cycle-detected" || event.detected ? " edge-cycle" :
                    (event.type === "distance-updated" ? " edge-improving" : " edge-active");
            }
            line.setAttribute("class", classes);
            graphEdges.appendChild(line);

            const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            background.setAttribute("x", midpointX - 28); background.setAttribute("y", midpointY - 10);
            background.setAttribute("width", 56); background.setAttribute("height", 20);
            background.setAttribute("rx", 6); background.setAttribute("class", "edge-label-bg");
            graphEdges.appendChild(background);
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", midpointX); label.setAttribute("y", midpointY);
            label.setAttribute("class", "edge-label" + (onFinalPath ? " highlight-label" : "") + (isCurrentEdge ? " edge-label-active" : ""));
            label.textContent = "₹" + connection.cost;
            graphEdges.appendChild(label);
        });

        cities.forEach(function (city) {
            const isSource = city.id === sourceCity;
            const isDestination = city.id === destinationCity;
            const isOnPath = highlightedPath.indexOf(city.id) !== -1;
            const isCurrent = event && event.currentCity === city.id;
            const isEdgeFrom = activeEdge && event.from === city.id;
            const isUpdated = event && event.type === "distance-updated" && event.to === city.id;
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            if (isOnPath || isCurrent || isEdgeFrom) {
                const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                halo.setAttribute("cx", city.x); halo.setAttribute("cy", city.y);
                halo.setAttribute("r", isOnPath ? 23 : 21);
                halo.setAttribute("class", isOnPath ? "node-halo" : (isCurrent ? "node-halo node-halo-current" : "node-halo node-halo-from"));
                group.appendChild(halo);
            }
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", city.x); circle.setAttribute("cy", city.y); circle.setAttribute("r", 14);
            let circleClass = "node-circle";
            if (isSource) { circleClass += " node-source"; }
            if (isDestination) { circleClass += " node-destination"; }
            if (isEdgeFrom) { circleClass += " node-edge-from"; }
            if (isUpdated) { circleClass += " node-updated"; }
            if (isCurrent) { circleClass += " node-current"; }
            circle.setAttribute("class", circleClass); group.appendChild(circle);
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", city.x); label.setAttribute("y", city.y + 37);
            label.setAttribute("class", "node-label" + (isOnPath ? " node-label-active" : ""));
            label.textContent = city.name; group.appendChild(label);
            if (distances) {
                const distanceLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
                distanceLabel.setAttribute("x", city.x); distanceLabel.setAttribute("y", city.y - 23);
                distanceLabel.setAttribute("class", "node-distance" + (isUpdated ? " node-distance-updated" : ""));
                distanceLabel.textContent = formatDistance(distances[city.id]);
                group.appendChild(distanceLabel);
            }
            graphNodes.appendChild(group);
        });
        byId("connection-count").textContent = graphConnections.length + (graphConnections.length === 1 ? " connection" : " connections");
    }

    function renderDistanceTable(run, distances, event, cursor) {
        distanceTableBody.textContent = "";
        let mostRecentUpdate = {};
        if (run && cursor >= 0) {
            for (let index = 0; index <= cursor; index += 1) {
                const savedEvent = run.result.events[index];
                if (savedEvent && savedEvent.type === "distance-updated") { mostRecentUpdate[savedEvent.to] = index; }
            }
        }
        cities.forEach(function (city) {
            const row = document.createElement("tr");
            const isCurrent = event && event.currentCity === city.id;
            const updatedNow = event && event.type === "distance-updated" && event.to === city.id;
            if (isCurrent) { row.classList.add("distance-row-current"); }
            if (mostRecentUpdate[city.id] !== undefined) { row.classList.add("distance-row-known"); }
            if (updatedNow) { row.classList.add("distance-row-updated"); }
            const cityCell = document.createElement("th"); cityCell.scope = "row"; cityCell.textContent = city.name;
            const distanceCell = document.createElement("td");
            const distanceValue = distances[city.id];
            distanceCell.textContent = formatDistance(distanceValue);
            if (updatedNow) { distanceCell.classList.add("distance-value-updated"); }
            const previousCell = document.createElement("td");
            previousCell.textContent = event && event.previousCity[city.id] ? getCityName(event.previousCity[city.id]) : "—";
            row.appendChild(cityCell); row.appendChild(distanceCell); row.appendChild(previousCell);
            distanceTableBody.appendChild(row);
        });
    }

    function humanizeEventType(type) {
        const labels = {
            "initialize": "Initialization", "iteration-start": "Iteration begins", "edge-selected": "Edge selected",
            "reachability-check": "Reachability check", "edge-skipped": "Edge skipped", "candidate-calculated": "Candidate cost",
            "distance-compared": "Compare distances", "distance-updated": "Distance updated", "distance-kept": "Distance kept",
            "iteration-end": "Iteration ends", "early-stop": "Early termination", "cycle-check-start": "Negative-cycle check",
            "cycle-edge-selected": "Cycle edge selected", "cycle-edge-result": "Cycle check result", "negative-cycle-detected": "Negative cycle found",
            "negative-cycle-clear": "No negative cycle", "route-unavailable": "Route unavailable", "reconstruction-start": "Rebuild route",
            "path-step": "Follow predecessor", "route-reconstructed": "Route reconstructed", "complete": "Algorithm complete"
        };
        return labels[type] || "Algorithm event";
    }

    function renderTimeline(cursor) {
        timelineItems.forEach(function (item, index) {
            item.classList.toggle("timeline-complete", index < cursor);
            item.classList.toggle("timeline-active", index === cursor);
            item.classList.toggle("timeline-upcoming", index > cursor);
        });
        if (cursor >= 0 && timelineItems[cursor]) {
            executionTimeline.scrollTop = Math.max(0, timelineItems[cursor].offsetTop - 80);
        }
    }

    function renderRouteResult(run) {
        const result = run.result;
        routeResult.textContent = "";
        totalCost.textContent = "—";
        iterationsSummary.textContent = result.iterationsPerformed + (result.iterationsPerformed === 1 ? " pass" : " passes");
        if (result.status === "negative-cycle") {
            resultTitle.textContent = "Negative cycle detected";
            const message = document.createElement("p"); message.className = "route-message error";
            message.textContent = "A reachable negative-weight cycle means the travel cost can keep decreasing. No shortest route is defined.";
            routeResult.appendChild(message); routeSummary.textContent = "No finite shortest route"; return;
        }
        if (result.status === "unreachable") {
            resultTitle.textContent = "No route available";
            const message = document.createElement("p"); message.className = "route-message";
            message.textContent = "There is no connection from " + getCityName(run.sourceCity) + " to " + getCityName(run.destinationCity) + ".";
            routeResult.appendChild(message); routeSummary.textContent = "Destination is unreachable"; return;
        }
        resultTitle.textContent = result.shortestPath.length === 1 ? "You're already there" : "Route found";
        const pathList = document.createElement("ol"); pathList.className = "path-list";
        result.shortestPath.forEach(function (cityId, index) {
            const item = document.createElement("li");
            const name = document.createElement("span"); name.className = "path-city"; name.textContent = getCityName(cityId); item.appendChild(name);
            if (index < result.shortestPath.length - 1) {
                const arrow = document.createElement("span"); arrow.className = "path-arrow"; arrow.textContent = "→"; arrow.setAttribute("aria-hidden", "true"); item.appendChild(arrow);
            }
            pathList.appendChild(item);
        });
        routeResult.appendChild(pathList);
        totalCost.textContent = "₹" + result.totalCost.toLocaleString("en-IN");
        routeSummary.textContent = result.shortestPath.length + (result.shortestPath.length === 1 ? " city" : " cities") + " on this route";
    }

    function updatePlaybackUi(run, cursor, event) {
        const count = run ? run.result.events.length : 0;
        playbackProgress.textContent = Math.max(0, cursor + 1) + " / " + count + " events";
        const playButton = byId("play-pause");
        playButton.textContent = playback && playback.isPlaying() ? "Playing…" : (cursor >= count - 1 && count ? "Play again" : (cursor >= 0 ? "Resume" : "Play"));
        byId("pause").disabled = !playback || !playback.isPlaying();
        byId("previous-step").disabled = !playback || cursor < 0;
        byId("next-step").disabled = !playback || cursor >= count - 1;
        byId("restart").disabled = !playback;
        byId("run-to-end").disabled = !playback;
        byId("play-pause").disabled = !playback;
        if (event && event.type === "complete") {
            renderRouteResult(run);
        } else if (run) {
            resultTitle.textContent = "Running Bellman–Ford";
            routeResult.textContent = "";
            const inProgress = document.createElement("p");
            inProgress.className = "empty-result";
            inProgress.textContent = "Follow the live execution to see the final route.";
            routeResult.appendChild(inProgress);
            totalCost.textContent = "—";
            routeSummary.textContent = "Execution in progress";
        }
    }

    function renderAtCursor(run, cursor) {
        if (run !== activeRun) { return; }
        const event = cursor >= 0 ? run.result.events[cursor] : null;
        const distances = event ? event.distances : initialDistances(run.sourceCity);
        renderDistanceTable(run, distances, event, cursor);
        renderGraph(run, event, distances);
        renderTimeline(cursor);
        if (event) {
            operationTitle.textContent = humanizeEventType(event.type) + (event.iteration ? " · Iteration " + event.iteration : "");
            operationExplanation.textContent = formatEventMessage(event.message);
            graphProgress.textContent = formatEventMessage(event.message);
        } else if (run) {
            const initialMessage = "Initial distances: " + getCityName(run.sourceCity) + " is ₹0; all other cities are ∞. Press Play or Next step to replay the recorded execution.";
            operationTitle.textContent = "Initial state";
            operationExplanation.textContent = initialMessage;
            graphProgress.textContent = initialMessage;
        } else {
            operationTitle.textContent = "Ready to run Bellman–Ford";
            operationExplanation.textContent = "The source is 0 and every other city is ∞. Press Play or Next Step to begin the recorded execution.";
            graphProgress.textContent = "Choose Find best route to create an execution trace; then replay each recorded operation.";
        }
        updatePlaybackUi(run, cursor, event);
    }

    function initialDistances(sourceCity) {
        const selectedSource = sourceCity || sourceSelect.value;
        const distances = {};
        cities.forEach(function (city) { distances[city.id] = city.id === selectedSource ? 0 : Infinity; });
        return distances;
    }

    function buildTimeline(result) {
        executionTimeline.textContent = "";
        timelineItems = [];
        result.events.forEach(function (event, index) {
            const item = document.createElement("li");
            item.className = "timeline-upcoming";
            item.setAttribute("data-event-index", index);
            const label = document.createElement("span"); label.className = "timeline-type"; label.textContent = humanizeEventType(event.type);
            const message = document.createElement("span"); message.className = "timeline-message"; message.textContent = formatEventMessage(event.message);
            item.appendChild(label); item.appendChild(message); executionTimeline.appendChild(item); timelineItems.push(item);
        });
        logCount.textContent = result.events.length + (result.events.length === 1 ? " event" : " events");
    }

    function setPlaybackEnabled(enabled) {
        playbackButtons.forEach(function (id) { byId(id).disabled = !enabled; });
    }

    function calculateRoute() {
        const runGenerationSource = sourceSelect.value;
        const runGenerationDestination = destinationSelect.value;
        if (playback) { playback.dispose(); playback = null; }
        activeRun = null;
        setPlaybackEnabled(false);
        const selectedCities = { sourceCity: runGenerationSource, destinationCity: runGenerationDestination };
        renderDistanceTable(null, initialDistances(runGenerationSource), null, -1);
        renderGraph(null, null, null, selectedCities);
        executionTimeline.textContent = "";
        timelineItems = [];
        logCount.textContent = "Generating execution trace";
        playbackProgress.textContent = "0 / 0 events";

        // The dropdown values captured at the start of this click seed a fresh run and trace.
        activeRun = createTravelPathRun(cities.map(function (city) { return city.id; }), connections, runGenerationSource, runGenerationDestination);
        const run = activeRun;
        buildTimeline(run.result);
        resultTitle.textContent = "Running Bellman–Ford";
        routeResult.textContent = "";
        const runningMessage = document.createElement("p"); runningMessage.className = "empty-result";
        runningMessage.textContent = "Follow the live execution to see the final route."; routeResult.appendChild(runningMessage);
        totalCost.textContent = "—"; routeSummary.textContent = "Execution in progress";
        iterationsSummary.textContent = run.result.iterationsPerformed + (run.result.iterationsPerformed === 1 ? " pass" : " passes");
        setPlaybackEnabled(true);
        playback = createPlaybackController({
            getEventCount: function () { return run.result.events.length; },
            onStep: function (cursor) {
                if (activeRun === run) { renderAtCursor(run, cursor); }
            }
        });
        playback.setSpeed(selectedPlaybackSpeed());
        renderAtCursor(run, -1);
        playback.play();
    }

    function resetRoutePresentation(message) {
        if (playback) { playback.dispose(); playback = null; }
        activeRun = null;
        setPlaybackEnabled(false);
        resultTitle.textContent = "Ready when you are";
        routeResult.textContent = "";
        const empty = document.createElement("p"); empty.className = "empty-result"; empty.textContent = message;
        routeResult.appendChild(empty);
        totalCost.textContent = "—"; routeSummary.textContent = "The route will appear here"; iterationsSummary.textContent = "0 passes";
        executionTimeline.textContent = "";
        const placeholder = document.createElement("li"); placeholder.className = "log-placeholder"; placeholder.textContent = "Find a route to create the algorithm's event timeline.";
        executionTimeline.appendChild(placeholder); timelineItems = [];
        logCount.textContent = "Waiting for a route"; playbackProgress.textContent = "0 / 0 events";
        operationTitle.textContent = "Waiting for a route"; operationExplanation.textContent = "Choose your cities and click Find best route to record Bellman–Ford's operations.";
        graphProgress.textContent = "Choose your cities, then click “Find best route” to watch the algorithm explore.";
        const initial = initialDistances();
        renderDistanceTable(null, initial, null, -1);
        renderGraph(null, null, null);
    }

    function updateGraphZoom() {
        graphViewport.setAttribute("transform", "translate(" + graphTranslateX + " " + graphTranslateY + ") scale(" + graphScale + ")");
        zoomLevel.textContent = Math.round(graphScale * 100) + "%";
    }
    function changeGraphZoom(change) {
        graphScale = Math.min(2.6, Math.max(0.65, graphScale + change)); updateGraphZoom();
    }
    function resetGraphZoom() { graphScale = 1; graphTranslateX = 0; graphTranslateY = 0; updateGraphZoom(); }
    function addOrUpdateConnection(fromCity, toCity, cost) {
        for (let index = 0; index < connections.length; index += 1) {
            const connection = connections[index];
            if ((connection.from === fromCity && connection.to === toCity) || (connection.from === toCity && connection.to === fromCity)) {
                connection.cost = cost; return false;
            }
        }
        connections.push({ from: fromCity, to: toCity, cost: cost }); return true;
    }

    byId("find-route").addEventListener("click", calculateRoute);
    sourceSelect.addEventListener("change", function () { resetRoutePresentation("Your city selections changed. Click Find best route to run Bellman–Ford."); });
    destinationSelect.addEventListener("change", function () { resetRoutePresentation("Your city selections changed. Click Find best route to run Bellman–Ford."); });
    byId("play-pause").addEventListener("click", function () { if (playback && activeRun) { playback.play(); const cursor = playback.getCursor(); updatePlaybackUi(activeRun, cursor, cursor >= 0 ? activeRun.result.events[cursor] : null); } });
    byId("pause").addEventListener("click", function () { if (playback && activeRun) { playback.pause(); const cursor = playback.getCursor(); updatePlaybackUi(activeRun, cursor, cursor >= 0 ? activeRun.result.events[cursor] : null); } });
    byId("next-step").addEventListener("click", function () { if (playback) { playback.next(); } });
    byId("previous-step").addEventListener("click", function () { if (playback) { playback.previous(); } });
    byId("restart").addEventListener("click", function () { if (playback) { playback.restart(); } });
    byId("run-to-end").addEventListener("click", function () { if (playback) { playback.runToEnd(); } });
    speedSlider.addEventListener("input", function () {
        const selectedSpeed = selectedPlaybackSpeed();
        const value = playback ? playback.setSpeed(selectedSpeed) : selectedSpeed;
        speedOutput.textContent = formatPlaybackSpeed(value);
    });
    byId("zoom-in").addEventListener("click", function () { changeGraphZoom(0.2); });
    byId("zoom-out").addEventListener("click", function () { changeGraphZoom(-0.2); });
    byId("zoom-reset").addEventListener("click", resetGraphZoom);
    graphElement.addEventListener("wheel", function (event) { event.preventDefault(); changeGraphZoom(event.deltaY < 0 ? 0.12 : -0.12); }, { passive: false });
    graphElement.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) { return; }
        panPointer = { x: event.clientX, y: event.clientY }; graphElement.classList.add("is-panning"); graphElement.setPointerCapture(event.pointerId);
    });
    graphElement.addEventListener("pointermove", function (event) {
        if (panPointer === null) { return; }
        const bounds = graphElement.getBoundingClientRect();
        graphTranslateX += (event.clientX - panPointer.x) * 760 / bounds.width;
        graphTranslateY += (event.clientY - panPointer.y) * 430 / bounds.height;
        panPointer = { x: event.clientX, y: event.clientY }; updateGraphZoom();
    });
    function finishGraphPan(event) {
        panPointer = null; graphElement.classList.remove("is-panning");
        if (graphElement.hasPointerCapture(event.pointerId)) { graphElement.releasePointerCapture(event.pointerId); }
    }
    graphElement.addEventListener("pointerup", finishGraphPan);
    graphElement.addEventListener("pointercancel", finishGraphPan);

    byId("add-route-form").addEventListener("submit", function (event) {
        event.preventDefault();
        const fromCity = routeFromSelect.value;
        const toCity = routeToSelect.value;
        const cost = Number(byId("route-cost").value);
        addRouteMessage.classList.remove("error");
        if (fromCity === toCity) {
            addRouteMessage.textContent = "Choose two different cities for a connection."; addRouteMessage.classList.add("error"); return;
        }
        if (!Number.isFinite(cost) || cost < 0) {
            addRouteMessage.textContent = "Enter a valid non-negative travel cost."; addRouteMessage.classList.add("error"); return;
        }
        const wasAdded = addOrUpdateConnection(fromCity, toCity, cost);
        resetRoutePresentation("The network changed. Click Find best route to run Bellman–Ford on the updated connections.");
        addRouteMessage.textContent = wasAdded ? "Two-way route added. Click Find best route to calculate again." : "Existing route cost updated. Click Find best route to calculate again.";
    });

    fillCitySelect(sourceSelect, cities[0].id);
    fillCitySelect(destinationSelect, "surat");
    fillCitySelect(routeFromSelect, "ahmedabad");
    fillCitySelect(routeToSelect, "surat");
    setPlaybackEnabled(false);
    renderDistanceTable(null, initialDistances(), null, -1);
    renderGraph(null, null, null);
    updateGraphZoom();
    speedOutput.textContent = formatPlaybackSpeed(selectedPlaybackSpeed());
}
