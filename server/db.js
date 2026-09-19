require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Supabase client initialized.");
} else {
  console.warn("Supabase credentials missing. Persistence disabled, falling back to in-memory.");
}

async function getOrCreateProfile(username) {
  if (!supabase) return { id: crypto.randomUUID(), username, isFallback: true };

  try {
    let { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching profile:", error);
      return { id: crypto.randomUUID(), username, isFallback: true };
    }

    if (!profile) {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([{ id: crypto.randomUUID(), username }])
        .select()
        .single();

      if (insertError) {
        console.error("Error creating profile:", insertError);
        return { id: crypto.randomUUID(), username, isFallback: true };
      }
      profile = newProfile;
    }

    // Ensure player_stats exists
    const { data: stats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', profile.id)
      .single();

    if (!stats) {
      await supabase.from('player_stats').insert([{
        player_id: profile.id,
        kills: 0,
        deaths: 0,
        damage: 0
      }]);
    }

    return profile;
  } catch (err) {
    console.error("Database failure in getOrCreateProfile:", err);
    return { id: crypto.randomUUID(), username, isFallback: true };
  }
}

async function saveMatchResult({
  match_id,
  player_id,
  result,
  kills,
  deaths,
  damage,
  score,
  players = []
} = {}) {
  const requiredFields = [
    'match_id',
    'player_id',
    'result',
    'kills',
    'deaths',
    'damage',
    'score'
  ];
  const missingFields = requiredFields.filter((field) => {
    const value = { match_id, player_id, result, kills, deaths, damage, score }[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  if (missingFields.length > 0) {
    return { error: new Error(`Missing required match result fields: ${missingFields.join(', ')}`) };
  }

  const invalidNumericFields = ['kills', 'deaths', 'damage', 'score'].filter((field) => {
    const value = { kills, deaths, damage, score }[field];
    return !Number.isFinite(value);
  });

  if (invalidNumericFields.length > 0) {
    return { error: new Error(`Match result fields must be finite numbers: ${invalidNumericFields.join(', ')}`) };
  }

  if (!supabase) {
    return { error: new Error('Supabase client is not initialized') };
  }

  try {
    const { data: match, error: matchError } = await supabase
      .from('match_results')
      .insert([{
        match_id,
        player_id,
        result,
        kills,
        deaths,
        damage,
        score
      }])
      .select()
      .single();

    if (matchError) {
      console.error("Failed to insert match_results:", matchError);
      return { error: matchError };
    }

    // Atomically increment stats using a Supabase RPC.
    // If the game does not have a real match lifecycle, this function won't be called.
    for (const playerStat of players) {
      if (playerStat.isFallback) continue;

      const { error: updateError } = await supabase
        .rpc('increment_player_stats', {
          p_player_id: playerStat.playerId,
          p_kills: playerStat.kills || 0,
          p_deaths: playerStat.deaths || 0,
          p_damage: playerStat.damage || 0,
          p_wins: playerStat.wins || 0
        });

      if (updateError) {
        console.error(`Failed to update stats for ${playerStat.playerId}:`, updateError);
      }
    }

    return { data: match, error: null };
  } catch (err) {
    console.error("Database failure in saveMatchResult:", err);
    return { error: err };
  }
}

module.exports = {
  getOrCreateProfile,
  saveMatchResult
};
