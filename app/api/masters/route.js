import { NextResponse } from "next/server";

const ACCESS_LEVEL = "trial";
const GOLF_TOUR = "pga";
const LANGUAGE_CODE = "en";
const SEASON_YEAR = "2026";
const FORMAT = "json";

/** Trial keys are strict; align with client refresh (app/page.tsx API_REFRESH_MS). */
const CACHE_TTL_MS = 300_000;

let lastSuccess = null;

function normalizeName(name = "") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function looksLikeMastersTournament(tournament) {
  const name = normalizeName(tournament?.name || "");
  const venue = normalizeName(tournament?.venue?.name || "");
  const location = normalizeName(
    `${tournament?.venue?.city || ""} ${tournament?.venue?.state || ""} ${tournament?.venue?.country || ""}`
  );

  return (
    name.includes("masters") ||
    venue.includes("augusta national") ||
    location.includes("augusta")
  );
}

async function fetchJson(url, apiKey) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Sportradar returned ${res.status}: ${text}`);
    err.upstreamStatus = res.status;
    throw err;
  }

  return res.json();
}

function mapStandingToPlayer(standing) {
  const name = `${standing.first_name || ""} ${standing.last_name || ""}`.trim();

  const currentRound =
    Array.isArray(standing.rounds) && standing.rounds.length
      ? standing.rounds.find((r) => (r?.thru || 0) > 0) || standing.rounds[0]
      : null;

  let thru = "-";
  if (currentRound?.thru === 18) {
    thru = "F";
  } else if ((currentRound?.thru || 0) > 0) {
    thru = String(currentRound.thru);
  }

  let status = "Not started";
  if (thru === "F") status = "Finished";
  else if (thru !== "-") status = "In progress";

  return {
    name,
    score: typeof standing.score === "number" ? standing.score : 0,
    pos:
      typeof standing.position === "number"
        ? `${standing.tied ? "T" : ""}${standing.position}`
        : "-",
    thru,
    status,
    country: standing.country || "",
    amateur: Boolean(standing.amateur),
  };
}

export async function GET() {
  const now = Date.now();
  if (lastSuccess && now - lastSuccess.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...lastSuccess.body, fromCache: true });
  }

  try {
    const apiKey = process.env.SPORTRADAR_API_KEY;

    if (!apiKey) {
      throw new Error("Missing SPORTRADAR_API_KEY in .env.local");
    }

    const scheduleUrl =
      `https://api.sportradar.com/golf/${ACCESS_LEVEL}/${GOLF_TOUR}/v3/` +
      `${LANGUAGE_CODE}/${SEASON_YEAR}/tournaments/schedule.${FORMAT}`;

    const scheduleData = await fetchJson(scheduleUrl, apiKey);

    const tournaments = Array.isArray(scheduleData?.tournaments)
      ? scheduleData.tournaments
      : Array.isArray(scheduleData)
      ? scheduleData
      : [];

    const masters = tournaments.find(looksLikeMastersTournament);

    if (!masters?.id) {
      throw new Error("Could not find Masters tournament in Sportradar schedule");
    }

    const leaderboardUrl =
      `https://api.sportradar.com/golf/${ACCESS_LEVEL}/${GOLF_TOUR}/v3/` +
      `${LANGUAGE_CODE}/${SEASON_YEAR}/tournaments/${masters.id}/leaderboard.${FORMAT}`;

    const leaderboardData = await fetchJson(leaderboardUrl, apiKey);

    const standings = Array.isArray(leaderboardData?.leaderboard)
      ? leaderboardData.leaderboard
      : [];

    const players = standings
      .map(mapStandingToPlayer)
      .filter((p) => p.name);

    const body = {
      updatedAt: new Date().toISOString(),
      source: "sportradar",
      tournament: {
        id: masters.id,
        name: masters.name || "Masters Tournament",
      },
      status: leaderboardData?.status || null,
      players,
    };
    lastSuccess = { body, at: Date.now() };
    return NextResponse.json(body);
  } catch (error) {
    const upstreamStatus = error?.upstreamStatus;
    const message = error instanceof Error ? error.message : "Unknown error";
    const isRateLimited = upstreamStatus === 429 || message.includes("429");

    if (isRateLimited && lastSuccess) {
      return NextResponse.json({
        ...lastSuccess.body,
        stale: true,
        rateLimited: true,
        error:
          "Sportradar rate limit (429). Showing last successful data until the limit resets.",
      });
    }

    const status = isRateLimited ? 503 : 500;
    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        source: "error",
        error: message,
        players: [],
      },
      { status }
    );
  }
}