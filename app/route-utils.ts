export type ParsedCoordinate = {
  longitude: number;
  latitude: number;
  normalized: string;
};

export type CoordinateResult =
  | { ok: true; value: ParsedCoordinate; wasReversed: boolean }
  | { ok: false; error: string };

const TAIWAN_BOUNDS = {
  minLongitude: 118,
  maxLongitude: 123,
  minLatitude: 21,
  maxLatitude: 26.5,
};

export function parseCoordinate(input: unknown): CoordinateResult {
  if (typeof input !== "string" || !input.trim()) {
    return { ok: false, error: "缺少圖資座標" };
  }

  const values = input
    .trim()
    .replace(/[，、；;]/g, ",")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);

  if (values.length !== 2 || values.some((value) => !Number.isFinite(value))) {
    return { ok: false, error: "座標格式應為經度,緯度" };
  }

  let [longitude, latitude] = values;
  let wasReversed = false;
  if (isTaiwanCoordinate(latitude, longitude) && !isTaiwanCoordinate(longitude, latitude)) {
    [longitude, latitude] = [latitude, longitude];
    wasReversed = true;
  }

  if (!isTaiwanCoordinate(longitude, latitude)) {
    return { ok: false, error: "座標不在台灣合理範圍內" };
  }

  return {
    ok: true,
    value: {
      longitude,
      latitude,
      normalized: `${longitude.toFixed(6)},${latitude.toFixed(6)}`,
    },
    wasReversed,
  };
}

function isTaiwanCoordinate(longitude: number, latitude: number) {
  return (
    longitude >= TAIWAN_BOUNDS.minLongitude &&
    longitude <= TAIWAN_BOUNDS.maxLongitude &&
    latitude >= TAIWAN_BOUNDS.minLatitude &&
    latitude <= TAIWAN_BOUNDS.maxLatitude
  );
}

export function distanceKm(a: ParsedCoordinate, b: ParsedCoordinate) {
  const radiusKm = 6371;
  const radians = (degree: number) => (degree * Math.PI) / 180;
  const dLatitude = radians(b.latitude - a.latitude);
  const dLongitude = radians(b.longitude - a.longitude);
  const value =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLongitude / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function nearestNeighborOrder<T extends { coordinates: string }>(
  items: T[],
  startCoordinates?: string,
) {
  const parsedItems = items.map((item, index) => ({
    item,
    index,
    parsed: parseCoordinate(item.coordinates),
  }));
  const valid = parsedItems.filter(
    (entry): entry is typeof entry & { parsed: Extract<CoordinateResult, { ok: true }> } =>
      entry.parsed.ok,
  );
  const invalid = parsedItems.filter((entry) => !entry.parsed.ok);
  const start = startCoordinates ? parseCoordinate(startCoordinates) : null;
  let current = start?.ok ? start.value : valid[0]?.parsed.value;
  const remaining = [...valid];
  const ordered: typeof valid = [];

  while (remaining.length) {
    let bestIndex = 0;
    if (current) {
      let bestDistance = Number.POSITIVE_INFINITY;
      remaining.forEach((entry, index) => {
        const distance = distanceKm(current!, entry.parsed.value);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
    }
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next.parsed.value;
  }

  return [...ordered, ...invalid].map((entry) => entry.item);
}

export function googleMapsUrl(coordinates: string) {
  const parsed = parseCoordinate(coordinates);
  if (!parsed.ok) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parsed.value.normalized)}&travelmode=driving`;
}

export function appleMapsUrl(coordinates: string) {
  const parsed = parseCoordinate(coordinates);
  if (!parsed.ok) return "";
  return `https://maps.apple.com/?daddr=${encodeURIComponent(parsed.value.normalized)}&dirflg=d`;
}
