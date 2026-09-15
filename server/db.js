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
        .insert([{ username }])
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
      .eq('profile_id', profile.id)
      .single();

    if (!stats) {
      await supabase.from('player_stats').insert([{
        profile_id: profile.id,
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

async function saveMatchResult(matchData) {
  if (!supabase) return;

  try {
    const { data: match, error: matchError } = await supabase
      .from('match_results')
      .insert([{}]) // Minimal insert
      .select()
      .single();

    if (matchError) {
      console.error("Failed to insert match_results:", matchError);
    }

    // Atomically increment stats using a Supabase RPC.
    // If the game does not have a real match lifecycle, this function won't be called.
    for (const playerStat of matchData.players) {
      if (playerStat.isFallback) continue;
      
      const { error: updateError } = await supabase
        .rpc('increment_player_stats', {
          p_profile_id: playerStat.profileId,
          p_kills: playerStat.kills || 0,
          p_deaths: playerStat.deaths || 0,
          p_damage: playerStat.damage || 0,
          p_wins: playerStat.wins || 0
        });

      if (updateError) {
         console.error(`Failed to update stats for ${playerStat.profileId}:`, updateError);
      }
    }
  } catch (err) {
    console.error("Database failure in saveMatchResult:", err);
  }
}

module.exports = {
  getOrCreateProfile,
  saveMatchResult
};
