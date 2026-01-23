const JAMENDO_CLIENT_ID = "cd607042";

export async function fetchCasinoTracks() {
  const res = await fetch(
    `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_CLIENT_ID}&format=json&limit=10&tags=ambient,lounge,chill&audioformat=mp31`
  );

  const data = await res.json();
  return data.results.map(track => ({
    id: track.id,
    name: track.name,
    artist: track.artist_name,
    url: track.audio
  }));
}
