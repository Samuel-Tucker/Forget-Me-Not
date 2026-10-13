function normalise(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function subsequenceScore(query, candidate) {
  let queryIndex = 0;
  let score = 0;
  let previousMatch = -2;

  for (let index = 0; index < candidate.length && queryIndex < query.length; index += 1) {
    if (candidate[index] !== query[queryIndex]) continue;
    score += index === previousMatch + 1 ? 5 : 1;
    if (index === 0 || candidate[index - 1] === " ") score += 4;
    previousMatch = index;
    queryIndex += 1;
  }

  return queryIndex === query.length ? score - candidate.length * 0.01 : -1;
}

export function scoreRecord(record, rawQuery) {
  const query = normalise(rawQuery);
  if (!query) return 0;

  const fields = [
    { value: normalise(record.name), weight: 9 },
    { value: normalise(record.tags?.join(" ")), weight: 7 },
    { value: normalise(record.type), weight: 6 },
    { value: normalise(record.value), weight: 3 }
  ];

  let total = 0;
  for (const term of query.split(" ")) {
    let best = -1;
    for (const field of fields) {
      if (!field.value) continue;
      const exactIndex = field.value.indexOf(term);
      const fieldScore = exactIndex >= 0
        ? field.weight * 20 - exactIndex
        : subsequenceScore(term, field.value) * field.weight;
      best = Math.max(best, fieldScore);
    }
    if (best < 0) return -1;
    total += best;
  }
  return total;
}

export function searchRecords(records, query) {
  if (!normalise(query)) return [];
  return records
    .map((record) => ({ record, score: scoreRecord(record, query) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name))
    .map(({ record }) => record);
}
