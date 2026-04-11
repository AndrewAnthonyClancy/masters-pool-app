import { NextResponse } from "next/server";

const MASTERS_CONFIG_URL = "https://www.masters.com/en_US/json/gen/config_web.json";
/** Keep in sync with API_REFRESH_MS in app/page.tsx */
const CACHE_TTL_MS = 300_000;

let lastSuccess = null;

function repairEncoding(value = "") {
  const text = String(value || "");

  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    return repaired.includes("\uFFFD") ? text : repaired;
  } catch {
    return text;
  }
}

function parseScore(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (value === "E") return 0;

  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function getCurrentRoundKey(rawRound) {
  const roundNumber = Number.parseInt(String(rawRound || "").replace(/^0+/, ""), 10);
  return Number.isFinite(roundNumber) && roundNumber > 0 ? `round${roundNumber}` : null;
}

function getPlayerStatus(player, roundKey) {
  const roundData = roundKey ? player?.[roundKey] : null;
  const roundStatus = String(roundData?.roundStatus || "").toUpperCase();
  const statusCode = String(player?.newStatus || player?.status || "").toUpperCase();
  const thru = String(player?.thru || "").trim();
  const teeTime = String(roundData?.teetime || player?.teetime || "").trim();

  if (statusCode === "C") {
    return { thru: "-", status: "CUT" };
  }

  if (statusCode.includes("WD")) {
    return { thru: "-", status: "WD" };
  }

  if (thru) {
    return { thru, status: "In progress" };
  }

  if (roundStatus === "FINISHED" || statusCode.startsWith("F")) {
    return { thru: "F", status: "Finished" };
  }

  if (roundStatus === "PRE" && teeTime) {
    return { thru: teeTime, status: "Tee time" };
  }

  return { thru: "-", status: "Not started" };
}

function mapPlayer(player, roundKey) {
  const { thru, status } = getPlayerStatus(player, roundKey);
  const fullName = repairEncoding(
    player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ").trim()
  );

  return {
    name: fullName,
    score: parseScore(player?.topar),
    pos: player?.pos || "-",
    thru,
    status,
    country: repairEncoding(player?.countryName || ""),
    amateur: Boolean(player?.amateur),
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent": "masters-tracker/1.0",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(`Masters returned ${res.status}: ${text}`);
    error.upstreamStatus = res.status;
    throw error;
  }

  return res.json();
}

async function getMastersFeedUrl() {
  const config = await fetchJson(MASTERS_CONFIG_URL);
  const path = config?.scoringData?.liveScore?.path;

  if (!path) {
    throw new Error("Masters config did not include a live score feed path");
  }

  return new URL(path, "https://www.masters.com").toString();
}

async function getLivePayload() {
  const feedUrl = await getMastersFeedUrl();
  const feed = await fetchJson(feedUrl);
  const data = feed?.data || {};
  const roundKey = getCurrentRoundKey(data?.currentRound);
  const players = Array.isArray(data?.player)
    ? data.player.map((player) => mapPlayer(player, roundKey)).filter((player) => player.name)
    : [];

  return {
    updatedAt: new Date().toISOString(),
    source: "masters.com",
    tournament: {
      name: "Masters Tournament",
      year: String(new Date().getFullYear()),
    },
    status: data?.statusRound || null,
    currentRound: roundKey,
    players,
  };
}

export async function GET() {
  const now = Date.now();

  if (lastSuccess && now - lastSuccess.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...lastSuccess.body, fromCache: true });
  }

  try {
    const body = await getLivePayload();
    lastSuccess = { body, at: Date.now() };
    return NextResponse.json(body);
  } catch (error) {
    if (lastSuccess) {
      return NextResponse.json({
        ...lastSuccess.body,
        stale: true,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return NextResponse.json(
      {
        updatedAt: new Date().toISOString(),
        source: "masters.com",
        error: error instanceof Error ? error.message : "Unknown error",
        players: [],
      },
      { status: 500 }
    );
  }
}
