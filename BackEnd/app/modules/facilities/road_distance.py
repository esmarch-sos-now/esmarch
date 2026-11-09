"""Road-network distances over the bundled Saigon OSM graph (shortest path via scipy/Dijkstra).

Mirrors the legacy RoadDistanceService: snap the origin to nearby graph nodes, run a multi-source shortest
path (a virtual source node carries each snap's connector length), then add each facility's snap connector.
"""

import gzip
import json
import logging
import math
from pathlib import Path

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import KDTree

from app.common.checks import meters

log = logging.getLogger(__name__)
GRAPH_FORMAT = 1
CELL_SIZE = 0.002
ORIGIN_SNAP_LIMIT = 8
FACILITY_SNAP_LIMIT = 24
GRAPH_PATH = Path(__file__).resolve().parents[2] / "resources" / "saigon-road-graph.json.gz"


class RoadGraph:
    def __init__(self, path: Path = GRAPH_PATH) -> None:
        with gzip.open(path, "rt", encoding="utf-8") as fh:
            raw = json.load(fh)
        bbox, coords = raw.get("bbox"), raw.get("coordinates")
        offsets, targets, dist = raw.get("offsets"), raw.get("targets"), raw.get("distances")
        if raw.get("format") != GRAPH_FORMAT or not bbox or len(bbox) != 4 or not coords or len(coords) % 2:
            raise ValueError("Saved road graph has an unsupported or incomplete format.")
        self.bbox = tuple(float(v) for v in bbox)
        self.coords = np.asarray(coords, dtype=np.float64).reshape(-1, 2)
        n = len(self.coords)
        self.offsets = np.asarray(offsets, dtype=np.int64)
        self.targets = np.asarray(targets, dtype=np.int32)
        self.weights = np.asarray(dist, dtype=np.float64)
        if (
            len(self.offsets) != n + 1
            or self.offsets[0] != 0
            or self.offsets[-1] != len(self.targets)
            or len(self.targets) != len(self.weights)
            or np.any(np.diff(self.offsets) < 0)
            or self.targets.min() < 0
            or self.targets.max() >= n
            or not np.isfinite(self.weights).all()
            or (self.weights < 0).any()
        ):
            raise ValueError("Saved road graph has an unsupported or incomplete format.")
        self.n = n
        self.cos = math.cos(math.radians(float(self.coords[:, 0].mean())))
        self.tree = KDTree(np.column_stack((self.coords[:, 0], self.coords[:, 1] * self.cos)))
        self.min_cell = (
            int(np.floor(self.coords[:, 0].min() / CELL_SIZE)),
            int(np.floor(self.coords[:, 1].min() / CELL_SIZE)),
        )

    def contains(self, lat: float, lng: float) -> bool:
        b = self.bbox
        return b[0] <= lat <= b[2] and b[1] <= lng <= b[3]

    def nearest(self, lat: float, lng: float, limit: int) -> list[tuple[int, float]]:
        """Nearest nodes within the legacy +/-4 grid-cell window, with geodesic connector length."""
        _, idx = self.tree.query([lat, lng * self.cos], k=min(limit, self.n))
        idx = np.atleast_1d(idx)
        row, col = math.floor(lat / CELL_SIZE), math.floor(lng / CELL_SIZE)
        found: list[tuple[int, float]] = []
        for node in idx:
            nlat, nlng = self.coords[node]
            if abs(math.floor(nlat / CELL_SIZE) - row) <= 4 and abs(math.floor(nlng / CELL_SIZE) - col) <= 4:
                found.append((int(node), meters(lat, lng, float(nlat), float(nlng))))
        found.sort(key=lambda s: s[1])
        return found


class RoadDistanceService:
    def __init__(self, graph: RoadGraph) -> None:
        self.graph = graph

    def distances(self, lat: float, lng: float, targets: list[tuple[float, float]]) -> list[int | None]:
        """Road meters per target (None: no route / outside the graph)."""
        g = self.graph
        if not targets or not g.contains(lat, lng):
            return [None] * len(targets)
        origins = g.nearest(lat, lng, ORIGIN_SNAP_LIMIT)
        if not origins:
            return [None] * len(targets)

        # Virtual source = node n, with one edge per origin snap weighted by the connector length.
        src = g.n
        indptr = np.concatenate((g.offsets, [g.offsets[-1] + len(origins)]))
        indices = np.concatenate((g.targets, [o[0] for o in origins])).astype(np.int32)
        data = np.concatenate((g.weights, [o[1] for o in origins]))
        graph = csr_matrix((data, indices, indptr), shape=(g.n + 1, g.n + 1))
        dist = dijkstra(graph, directed=True, indices=src)

        out: list[int | None] = []
        for t_lat, t_lng in targets:
            if t_lat == lat and t_lng == lng:
                out.append(0)
                continue
            best = math.inf
            if g.contains(t_lat, t_lng):
                for node, connector in g.nearest(t_lat, t_lng, FACILITY_SNAP_LIMIT):
                    best = min(best, dist[node] + connector)
            out.append(round(best) if math.isfinite(best) else None)
        return out


_service: RoadDistanceService | None = None


def get_road_service() -> RoadDistanceService | None:
    return _service


def load_road_service() -> RoadDistanceService:
    global _service
    _service = RoadDistanceService(RoadGraph())
    log.info("Road graph loaded: %d nodes", _service.graph.n)
    return _service
