# simple program showcasing the algorithm

INF = float("inf")


def bellman_ford(vertices, edges, source, destination):
    distances = {city: INF for city in vertices}
    previous = {city: None for city in vertices}
    distances[source] = 0

    iterations = 0
    for _ in range(len(vertices) - 1):
        iterations += 1
        changed = False

        for u, v, weight in edges:
            if distances[u] == INF:
                continue

            new_distance = distances[u] + weight
            if new_distance < distances[v]:
                distances[v] = new_distance
                previous[v] = u
                changed = True

        if not changed:
            break

    has_negative_cycle = any(
        distances[u] != INF and distances[u] + weight < distances[v]
        for u, v, weight in edges
    )

    if has_negative_cycle:
        return {
            "status": "negative-cycle",
            "path": [],
            "cost": None,
            "distances": distances,
            "previous": previous,
            "iterations": iterations,
        }

    if distances[destination] == INF:
        return {
            "status": "unreachable",
            "path": [],
            "cost": None,
            "distances": distances,
            "previous": previous,
            "iterations": iterations,
        }

    path = []
    city = destination
    while city is not None:
        path.append(city)
        city = previous[city]
    path.reverse()

    return {
        "status": "ok",
        "path": path,
        "cost": distances[destination],
        "distances": distances,
        "previous": previous,
        "iterations": iterations,
    }


def show(title, result):
    print(f"--- {title} ---")
    print("status:    ", result["status"])
    if result["status"] == "ok":
        print("path:      ", " -> ".join(result["path"]))
        print("total cost:", result["cost"])
    print("distances: ", result["distances"])
    print("iterations:", result["iterations"])
    print()


if __name__ == "__main__":
    cities = ["A", "B", "C", "D", "E"]

    roads = [
        ("A", "B", 4),
        ("A", "C", 2),
        ("C", "B", -1),
        ("B", "D", 3),
        ("C", "D", 5),
        ("D", "E", 1),
    ]
    show("A to E", bellman_ford(cities, roads, "A", "E"))

    show("E to A", bellman_ford(cities, roads, "E", "A"))

    bad_roads = roads + [("B", "C", 2), ("C", "B", -5)]
    show("negative cycle", bellman_ford(cities, bad_roads, "A", "E"))