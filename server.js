const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3000;

const RIOT_API_KEY = process.env.RIOT_API_KEY;

if (!RIOT_API_KEY) {
    console.error("RIOT_API_KEY not found in .env file. Please add it.");
    process.exit(1);
}

// Mappings for Riot API regions
const regionMappings = {
    "euw": "europe",
    "na": "americas",
    "eune": "europe",
    "kr": "asia",
    "jp": "asia",
    // Add other regions as needed
};

const platformMappings = {
    "euw": "euw1",
    "na": "na1",
    "eune": "eun1",
    "kr": "kr",
    "jp": "jp1",
     // Add other platforms as needed
};

app.use(cors());
app.use(express.static('public')); // Serve the HTML from a public folder

// API endpoint to get summoner's ranked data
app.get('/api/rank/:server/:summonerName/:tagLine', async (req, res) => {
    const { server, summonerName, tagLine } = req.params;
    const lowerCaseServer = server.toLowerCase();

    const continentalRegion = regionMappings[lowerCaseServer];
    const platformRegion = platformMappings[lowerCaseServer];

    if (!continentalRegion || !platformRegion) {
        return res.status(400).json({ error: 'Invalid server specified.' });
    }

    // Set up the headers for all Riot API requests
    const riotApiHeaders = {
        "X-Riot-Token": RIOT_API_KEY
    };

    try {
        // 1. Get PUUID from Riot ID
        const encodedSummonerName = encodeURIComponent(summonerName);
        const encodedTagLine = encodeURIComponent(tagLine);
        const accountUrl = `https://${continentalRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedSummonerName}/${encodedTagLine}`;
        const accountResponse = await fetch(accountUrl, { headers: riotApiHeaders });
        if (!accountResponse.ok) throw new Error(`Failed to fetch account data: ${accountResponse.statusText}`);
        const accountData = await accountResponse.json();
        const { puuid } = accountData;

        // 2. Get Ranked Data directly from PUUID (More efficient)
        const rankUrl = `https://${platformRegion}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`;
        const rankResponse = await fetch(rankUrl, { headers: riotApiHeaders });
        if (!rankResponse.ok) throw new Error(`Failed to fetch rank data: ${rankResponse.statusText}`);
        const rankData = await rankResponse.json();

        // Find the entry for Ranked Solo/Duo
        const rankedSoloInfo = rankData.find(entry => entry.queueType === 'RANKED_SOLO_5x5');

        if (!rankedSoloInfo) {
            return res.status(404).json({ error: 'No ranked solo/duo data found for this summoner.' });
        }

        // Format the data for the frontend
        const formattedData = {
            summonerName: summonerName,
            tagLine: tagLine,
            server: server.toUpperCase(),
            rank: rankedSoloInfo.tier,
            division: rankedSoloInfo.rank,
            leaguePoints: rankedSoloInfo.leaguePoints,
            wins: rankedSoloInfo.wins,
            losses: rankedSoloInfo.losses,
            // The Riot API does not provide recent LP gains directly.
            // The frontend will use a default value for this calculation.
            recentLPGains: []
        };

        res.json(formattedData);

    } catch (error) {
        console.error('Error fetching data from Riot API:', error.message);
        res.status(500).json({ error: `Failed to retrieve data from Riot API. Reason: ${error.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

