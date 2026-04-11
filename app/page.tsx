"use client";

import { useEffect, useMemo, useState } from "react";

type Player = {
  name: string;
  score: number;
  thru: string;
  pos: string;
  status?: string;
  country?: string;
  amateur?: boolean;
};

type PoolEntry = {
  contestant: string;
  picks: string[];
};

type PickDetail = {
  pick: string;
  golfer?: Player;
  value: number | null;
  label: string;
  reason: string;
  penalty: boolean;
};

type ScoredPick = PickDetail & { golfer: Player; value: number };

type RankedEntry = PoolEntry & {
  total: number;
  scoredPicks: ScoredPick[];
  missingPicks: string[];
  madeCutCount: number;
  activeHoles: string;
  countedPicks: ScoredPick[];
  droppedPicks: ScoredPick[];
  penaltyCount: number;
  pickDetails: PickDetail[];
  place: number;
};

type MastersApiResponse = {
  updatedAt?: string;
  source?: string;
  error?: string;
  players?: Player[];
};

const REFRESH_INTERVAL_MS = 30_000;

const MOCK_LEADERBOARD = [
  { name: "Scottie Scheffler", score: -4, thru: "12", pos: "T3" },
  { name: "Rory McIlroy", score: -2, thru: "10", pos: "T9" },
  { name: "Ludvig Åberg", score: -3, thru: "11", pos: "T5" },
  { name: "Jon Rahm", score: -1, thru: "9", pos: "T12" },
  { name: "Xander Schauffele", score: -1, thru: "8", pos: "T14" },
  { name: "Bryson DeChambeau", score: 0, thru: "7", pos: "T20" },
  { name: "Justin Rose", score: -2, thru: "F", pos: "T9" },
  { name: "Jordan Spieth", score: 1, thru: "9", pos: "T24" },
  { name: "Tommy Fleetwood", score: 0, thru: "11", pos: "T20" },
  { name: "Patrick Reed", score: 2, thru: "12", pos: "T33" },
  { name: "Justin Thomas", score: 1, thru: "8", pos: "T24" },
  { name: "J.J. Spaun", score: 1, thru: "9", pos: "T24" },
  { name: "Max Homa", score: 2, thru: "8", pos: "T31" },
  { name: "Wyndham Clark", score: -1, thru: "F", pos: "T14" },
  { name: "Keegan Bradley", score: 0, thru: "13", pos: "T20" },
  { name: "Bubba Watson", score: 3, thru: "7", pos: "T38" },
  { name: "Cameron Young", score: 1, thru: "10", pos: "T24" },
  { name: "Hideki Matsuyama", score: -1, thru: "11", pos: "T14" },
  { name: "Jacob Bridgeman", score: 2, thru: "6", pos: "T33" },
  { name: "Jason Day", score: 0, thru: "10", pos: "T20" },
  { name: "Shane Lowry", score: -1, thru: "12", pos: "T14" },
  { name: "Patrick Cantlay", score: 1, thru: "10", pos: "T24" },
  { name: "Sam Burns", score: 0, thru: "9", pos: "T20" },
  { name: "Dustin Johnson", score: 2, thru: "10", pos: "T33" },
  { name: "Fred Couples", score: 1, thru: "F", pos: "T24" },
  { name: "Ben Griffin", score: 0, thru: "8", pos: "T20" },
  { name: "Tyrrell Hatton", score: 1, thru: "11", pos: "T24" },
  { name: "Aldrich Potgieter", score: 3, thru: "7", pos: "T38" },
  { name: "Andrew Novak", score: 1, thru: "9", pos: "T24" },
  { name: "Corey Conners", score: -1, thru: "10", pos: "T14" },
  { name: "Michael Kim", score: 0, thru: "12", pos: "T20" },
  { name: "Alex Noren", score: 0, thru: "12", pos: "T20" },
  { name: "Nick Taylor", score: 1, thru: "11", pos: "T24" },
];

/** Keep in sync with CACHE_TTL_MS in app/api/masters/route.js */
const API_REFRESH_MS = 5 * 60 * 1000;
const API_REFRESH_SEC = 5 * 60;

function formatRefreshCountdown(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

const POOL_ENTRIES: PoolEntry[] = [
  { contestant: "Babyn, J & Lee, Rob", picks: ["Scottie Scheffler", "Rory McIlroy", "Jordan Spieth", "Jake Knapp", "Corey Conners", "Michael Kim", "Alex Noren", "Nick Taylor"] },
  { contestant: "Badders, Nolan", picks: ["Rory McIlroy", "Ludvig Aberg", "Xander Schauffele", "Justin Thomas", "Tyrrell Hatton", "Ben Griffin", "Aldrich Potgieter", "Andrew Novak"] },
  { contestant: "Bates, Dan", picks: ["Scottie Scheffler", "Rory McIlroy", "Tommy Fleetwood", "Jacob Bridgeman", "Corey Conners", "Alex Noren", "Michael Kim", "Sam Stevens"] },
  { contestant: "Boulay, Jean", picks: ["Scottie Scheffler", "Xander Schauffele", "Patrick Reed", "Jason Day", "Gary Woodland", "Brian Harman", "Dustin Johnson", "Zach Johnson"] },
  { contestant: "Brandt, Jess", picks: ["Scottie Scheffler", "Jon Rahm", "Xander Schauffele", "Justin Thomas", "Nicolai Hojgaard", "Wyndham Clark", "Dustin Johnson", "Fred Couples"] },
  { contestant: "Clancy, Sarah", picks: ["Scottie Scheffler", "Rory McIlroy", "Ludvig Aberg", "J.J. Spaun", "Max Homa", "Wyndham Clark", "Keegan Bradley", "Bubba Watson"] },
  { contestant: "Harris, Cory", picks: ["Scottie Scheffler", "Jon Rahm", "Cameron Young", "Shane Lowry", "Jake Knapp", "Ben Griffin", "Max Greyserman", "Nick Taylor"] },
  { contestant: "Howell, Matt", picks: ["Scottie Scheffler", "Xander Schauffele", "Hideki Matsuyama", "Jacob Bridgeman", "Nicolai Hojgaard", "Rasmus Hojgaard", "Harry Hall", "Michael Brennan"] },
  { contestant: "Jicha, Ryan", picks: ["Scottie Scheffler", "Rory McIlroy", "Xander Schauffele", "Patrick Cantlay", "Sam Burns", "Wyndham Clark", "Dustin Johnson", "Danny Willett"] },
  { contestant: "Kaetzer, Will", picks: ["Jon Rahm", "Rory McIlroy", "Matt Fitzpatrick", "Justin Thomas", "Shane Lowry", "Wyndham Clark", "Ryan Gerard", "Carlos Ortiz"] },
  { contestant: "Livieres, Oliver", picks: ["Scottie Scheffler", "Bryson DeChambeau", "Rory McIlroy", "Adam Scott", "Maverick McNealy", "Brian Harman", "Matthew McCarty", "Carlos Ortiz"] },
  { contestant: "Long, Trevor", picks: ["Scottie Scheffler", "Jon Rahm", "Xander Schauffele", "Shane Lowry", "Si Woo Kim", "Kurt Kitayama", "Ryan Gerard", "Kristoffer Reitan"] },
  { contestant: "McCarthy, Josh", picks: ["Scottie Scheffler", "Bryson DeChambeau", "Matt Fitzpatrick", "Shane Lowry", "Max Homa", "Casey Jarvis", "Keegan Bradley", "Charl Schwartzel"] },
  { contestant: "Wenske, Luke", picks: ["Scottie Scheffler", "Justin Rose", "Jordan Spieth", "Adam Scott", "Jason Day", "Dustin Johnson", "Sergio Garcia", "Bubba Watson"] },
  { contestant: "Woods, Randy", picks: ["Scottie Scheffler", "Bryson DeChambeau", "Ludvig Aberg", "Cameron Smith", "Gary Woodland", "Rasmus Hojgaard", "Wyndham Clark", "Nick Taylor"] },
];

function formatScore(score: number) {
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

function getScoreColor(score: number) {
  if (score < 0) return "#166534";
  if (score > 0) return "#b91c1c";
  return "#374151";
}

function getThruLabel(thru: string) {
  if (!thru || thru === "-") return "Not started";
  if (String(thru).includes(":")) return `Tee ${thru}`;
  if (thru === "F") return "Finished";
  return "In progress";
}

function getHoleLabel(thru: string) {
  if (!thru || thru === "-") return "-";
  if (String(thru).includes(":")) return "Tee time";
  if (thru === "F") return "18";
  return String(thru);
}

function comparePlayers(a: Player, b: Player) {
  const scoreA = typeof a.score === "number" ? a.score : 999;
  const scoreB = typeof b.score === "number" ? b.score : 999;
  if (scoreA !== scoreB) return scoreA - scoreB;
  return a.name.localeCompare(b.name);
}

function getPoolScoreInfo(golfer?: Player) {
  if (!golfer) {
    return { value: null, label: "Missing", reason: "Not returned by API", penalty: false };
  }

  const statusText = `${golfer.status || ""} ${golfer.thru || ""} ${golfer.pos || ""}`.toUpperCase();

  if (statusText.includes("WD") || statusText.includes("WITHDRAW")) {
    return { value: 16, label: "+16", reason: "WD weekend penalty", penalty: true };
  }

  if (statusText.includes("MC") || statusText.includes("CUT")) {
    return { value: 16, label: "+16", reason: "Missed cut penalty", penalty: true };
  }

  const score = Number(golfer.score);
  const safeScore = Number.isFinite(score) ? score : 0;
  return {
    value: safeScore,
    label: formatScore(safeScore),
    reason: "Live tournament score",
    penalty: false,
  };
}

function repairText(value: string = "") {
  const text = String(value || "");

  try {
    const bytes = Uint8Array.from(Array.from(text), (char) => char.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder().decode(bytes);
    return repaired.includes("\uFFFD") ? text : repaired;
  } catch {
    return text;
  }
}

function normalizeName(name: string = "") {
  return repairText(String(name || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export default function Page() {
  const [players, setPlayers] = useState<Player[]>(MOCK_LEADERBOARD);
  const [useMock, setUseMock] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [dataSource, setDataSource] = useState("masters.com");
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastPlayers, setLastPlayers] = useState<Player[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(API_REFRESH_SEC);
  const [selectedContestant, setSelectedContestant] = useState("Clancy, Sarah");
  const [lastPoolLeaderboard, setLastPoolLeaderboard] = useState<RankedEntry[]>([]);

  async function load() {
    setLastPoolLeaderboard(poolLeaderboard);
    setLastPlayers(players);
    setSecondsLeft(API_REFRESH_SEC);
    setLoading(true);

    if (useMock) {
      setApiError(null);
      setDataSource("mock");
      setPlayers(MOCK_LEADERBOARD.map((pl: Player) => ({
        ...pl,
        score: pl.score + (Math.random() > 0.9 ? 1 : Math.random() > 0.9 ? -1 : 0),
      })));
      setUpdatedAt(new Date());
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/masters", { cache: "no-store" });
      const data: MastersApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Live Masters feed request failed");
      }

      if (Array.isArray(data.players) && data.players.length > 0) {
        setPlayers(
          data.players.map((player) => ({
            ...player,
            name: repairText(player.name),
            country: player.country ? repairText(player.country) : player.country,
          }))
        );
        setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : new Date());
        setDataSource(data.source || "masters.com");
        setApiError(data.error || null);
        setLoading(false);
        return;
      }

      throw new Error(data.error || "Live Masters feed returned no players");
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Live Masters feed failed");
      setDataSource("masters.com");
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, API_REFRESH_MS);
    const countdown = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      clearInterval(id);
      clearInterval(countdown);
    };
  }, [useMock]);

  const sortedPlayers = useMemo(() => [...players].sort(comparePlayers), [players]);
  const leader = sortedPlayers[0];

  function getMovement(player: Player) {
    const prev = lastPlayers.find((p: Player) => p.name === player.name);
    if (!prev) return "";
    if (player.score < prev.score) return "^";
    if (player.score > prev.score) return "v";
    return "";
  }

  const golferMap = useMemo(() => {
    const map = new Map<string, Player>();
    sortedPlayers.forEach((player: Player) => {
      map.set(normalizeName(player.name), player);
    });
    return map;
  }, [sortedPlayers]);

  const poolLeaderboard = useMemo(() => {
    return POOL_ENTRIES.map((entry: PoolEntry) => {
      const pickDetails = entry.picks.map((pick: string) => {
        const golfer = golferMap.get(normalizeName(pick));
        const scoreInfo = getPoolScoreInfo(golfer);
        return {
          pick,
          golfer,
          ...scoreInfo,
        };
      });

      const scoredPicks = pickDetails.filter((item): item is ScoredPick => Boolean(item.golfer) && item.value !== null);
      const missingPicks = pickDetails.filter((item: PickDetail) => !item.golfer).map((item: PickDetail) => item.pick);
      const sortableScored = scoredPicks;
      const sortedByPoolScore = [...sortableScored].sort((a: ScoredPick, b: ScoredPick) => a.value - b.value);
      const countedPicks = sortedByPoolScore.slice(0, 6);
      const droppedPicks = sortedByPoolScore.slice(6);
      const total = countedPicks.reduce((sum: number, item: ScoredPick) => sum + item.value, 0);
      const activeHoles = scoredPicks
        .map((item: ScoredPick) => `${item.pick.split(" ").slice(-1)[0]} ${getHoleLabel(item.golfer.thru)}`)
        .join(", ");
      const madeCutCount = scoredPicks.filter((item: ScoredPick) => item.golfer.pos && item.golfer.pos !== "-").length;
      const penaltyCount = scoredPicks.filter((item: ScoredPick) => item.penalty).length;

      return {
        ...entry,
        total,
        scoredPicks,
        missingPicks,
        madeCutCount,
        activeHoles,
        countedPicks,
        droppedPicks,
        penaltyCount,
        pickDetails,
      };
    }).sort((a: Omit<RankedEntry, "place">, b: Omit<RankedEntry, "place">) => {
      if (a.total !== b.total) return a.total - b.total;
      if (a.missingPicks.length !== b.missingPicks.length) return a.missingPicks.length - b.missingPicks.length;
      return a.contestant.localeCompare(b.contestant);
    }).map((entry: Omit<RankedEntry, "place">, index: number) => ({ ...entry, place: index + 1 }));
  }, [golferMap]);

  const selectedEntry = poolLeaderboard.find((entry: RankedEntry) => entry.contestant === selectedContestant) || poolLeaderboard[0];

  function getStandingMovement(entry: RankedEntry) {
    const prev = lastPoolLeaderboard.find((p: RankedEntry) => p.contestant === entry.contestant);
    if (!prev) return "";
    if (entry.place < prev.place) return "^";
    if (entry.place > prev.place) return "v";
    return "";
  }

  const uniqueGolfersTracked = useMemo(() => {
    const allPicks = new Set<string>();
    POOL_ENTRIES.forEach((entry: PoolEntry) => entry.picks.forEach((pick: string) => allPicks.add(normalizeName(pick))));
    return allPicks.size;
  }, []);

  const golfersReturned = sortedPlayers.length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f6f7f2 0%, #eef3ea 100%)",
        padding: "16px 12px",
        fontFamily: "Arial, sans-serif",
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 24,
            padding: 18,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
            border: "1px solid #e5e7eb",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "inline-block", background: "#e8f2e8", color: "#166534", padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 12, letterSpacing: 0.3 }}>
                MASTERS POOL TOOL
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(28px, 7vw, 36px)", lineHeight: 1.1 }}>Live Pool Leaderboard</h1>
              <p style={{ margin: "10px 0 0", color: "#4b5563", fontSize: 16 }}>
                Track the full pool, see who is leading, and drill into each contestant's golfers.
              </p>
              <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 14 }}>
                Rules: best 6 of 8 scores count. Worst 2 are dropped. Missed cut or WD counts as +8 for each weekend round (+16 total).
              </p>
              {!useMock && apiError ? (
                <p style={{ margin: "8px 0 0", color: "#b45309", fontSize: 14 }}>
                  Live feed warning: {apiError}
                </p>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={load}
                style={{ border: "none", background: "#111827", color: "white", padding: "12px 16px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <button
                onClick={() => setUseMock((v) => !v)}
                style={{ border: "1px solid #d1d5db", background: "white", color: "#111827", padding: "12px 16px", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}
              >
                {useMock ? "Using Mock Data" : "Using masters.com"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 20 }}>
            <div style={{ background: "#f9fafb", borderRadius: 18, padding: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Source</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>{useMock ? "Mock" : dataSource}</div>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 18, padding: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Updated</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>{updatedAt ? updatedAt.toLocaleTimeString() : "-"}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Refresh in {formatRefreshCountdown(secondsLeft)}
              </div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>{updatedAt ? updatedAt.toLocaleTimeString() : "-"}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Refresh in {formatRefreshCountdown(secondsLeft)}
              </div>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 18, padding: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Pool Entries</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>{poolLeaderboard.length}</div>
            </div>
            <div style={{ background: "#f9fafb", borderRadius: 18, padding: 16, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, textTransform: "uppercase" }}>Current Pool Leader</div>
              <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800 }}>
                {poolLeaderboard[0] ? `${poolLeaderboard[0].contestant} | ${formatScore(poolLeaderboard[0].total)}` : "-"}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
          <div style={{ background: "#ffffff", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e7eb", fontWeight: 800, fontSize: 20 }}>
              Pool Standings
            </div>
            <div style={{ overflowX: "auto" }}>
              <table width="100%" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", color: "#6b7280", textTransform: "uppercase", fontSize: 12 }}>
                    <th align="left" style={{ padding: "14px 22px" }}>Place</th>
                    <th align="left" style={{ padding: "14px 10px" }}>Contestant</th>
                    <th align="left" style={{ padding: "14px 10px" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {poolLeaderboard.map((entry) => (
                    <tr
                      key={entry.contestant}
                      onClick={() => setSelectedContestant(entry.contestant)}
                      style={{ borderTop: "1px solid #f3f4f6", cursor: "pointer", background: selectedContestant === entry.contestant ? "#f0fdf4" : "white" }}
                    >
                      <td style={{ padding: "14px 14px", fontWeight: 800 }}>{entry.place} {getStandingMovement(entry)}</td>
                      <td style={{ padding: "14px 10px", fontWeight: 700 }}>{entry.contestant}</td>
                      <td style={{ padding: "14px 10px", fontSize: 20, fontWeight: 800, color: getScoreColor(entry.total) }}>{formatScore(entry.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            <div style={{ background: "#ffffff", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e7eb", fontWeight: 800, fontSize: 20 }}>
                Selected Entry
              </div>
              {selectedEntry && (
                <div style={{ padding: 22 }}>
                  <div style={{ fontSize: 24, fontWeight: 800 }}>{selectedEntry.contestant}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ background: "#ecfdf5", color: "#166534", padding: "8px 12px", borderRadius: 999, fontWeight: 700 }}>
                      Counting 6 | {formatScore(selectedEntry.total)}
                    </span>
                    <span style={{ background: "#f3f4f6", color: "#374151", padding: "8px 12px", borderRadius: 999, fontWeight: 700 }}>
                      Dropped 2 | {selectedEntry.droppedPicks.length}
                    </span>
                    <span style={{ background: "#fff7ed", color: "#9a3412", padding: "8px 12px", borderRadius: 999, fontWeight: 700 }}>
                      Penalties {selectedEntry.penaltyCount}
                    </span>
                    <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "8px 12px", borderRadius: 999, fontWeight: 700 }}>
                      Missing {selectedEntry.missingPicks.length}
                    </span>
                  </div>

                  <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                    {selectedEntry.pickDetails.map((item) => {
                      const golfer = item.golfer;
                      const counted = selectedEntry.countedPicks.some((countedPick) => countedPick.pick === item.pick);
                      const dropped = selectedEntry.droppedPicks.some((droppedPick) => droppedPick.pick === item.pick);
                      const isActive = golfer && golfer.thru && golfer.thru !== "-" && golfer.thru !== "F" && !String(golfer.thru).includes(":");
                      return (
                        <div
                          key={item.pick}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 18,
                            padding: 14,
                            background: !golfer ? "#fff7ed" : isActive ? "#f0fdf4" : "white",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ fontWeight: 800, fontSize: 18 }}>{item.pick}</span>
                                {isActive && <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Live</span>}
                                {counted && <span style={{ background: "#ecfdf5", color: "#166534", padding: "3px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Counts</span>}
                                {dropped && <span style={{ background: "#f3f4f6", color: "#374151", padding: "3px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Dropped</span>}
                                {item.penalty && <span style={{ background: "#fff7ed", color: "#9a3412", padding: "3px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Penalty</span>}
                              </div>
                              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                                <div style={{ background: "#f9fafb", borderRadius: 12, padding: 10 }}>
                                  <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 700 }}>Score</div>
                                  <div style={{ marginTop: 4, fontSize: 22, fontWeight: 800, color: golfer ? getScoreColor(item.value ?? 0) : "#9a3412" }}>
                                    {golfer ? `${item.label} ${getMovement(golfer)}` : "--"}
                                  </div>
                                </div>
                                <div style={{ background: "#f9fafb", borderRadius: 12, padding: 10 }}>
                                  <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 700 }}>Hole</div>
                                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color: isActive ? "#166534" : "#111827" }}>
                                    {golfer ? getHoleLabel(golfer.thru) : "-"}
                                  </div>
                                </div>
                                <div style={{ background: "#f9fafb", borderRadius: 12, padding: 10 }}>
                                  <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 700 }}>Pos</div>
                                  <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>
                                    {golfer ? golfer.pos || "-" : "-"}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div style={{ fontWeight: 900, fontSize: 20, color: counted ? "#166534" : "#9ca3af", paddingTop: 4, minWidth: 20, textAlign: "right" }}>
                              {counted ? "" : "X"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: "#ffffff", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #e5e7eb", fontWeight: 800, fontSize: 20 }}>
                Live Golfer Board
              </div>
              <div style={{ maxHeight: 520, overflowY: "auto" }}>
                {sortedPlayers.map((p, index) => (
                  <div key={p.name} style={{ padding: "14px 16px", borderTop: index === 0 ? "none" : "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>Hole {getHoleLabel(p.thru)} | Pos {p.pos || "-"}</div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: getScoreColor(p.score), whiteSpace: "nowrap" }}>
                      {formatScore(p.score)} {getMovement(p)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
