const SPOTIFY_API_URL = "https://api.spotify.com";
// الفانكشن اللى هتجيب البلاى لسيت بتاعتنا بناء على الكلمات اللى هنبعتهالو
// const fetchPlaylistsByQuery = async (query , token , limit = 3) => {
//     // هنعمل انكود للكويرى علشان نبتها مظبوطة
//     const encodedQuery = encodeURIComponent(query);

//     // بعد كدا نبعت الريكوست لسبوتيفاى بالسيرش اللى عايزينه
//     const res = await fetch(`${SPOTIFY_API_URL}/v1/search?q=${encodedQuery}&type=track&limit=${limit}` , {
//         headers: { 'Authorization': `Bearer ${token}` }
//     });

//     if(!res.ok) return [];
//     const data = await res.json();
//     return data.playlists?.items?.map(p => p?.id).filter(Boolean) || [];
// } 

// الفانكشن اللى هتسحب الاغانى من بلاى ليست معينة
// const fetchTracksDirectly = async (query , token , limit = 10) => {
//     const encodedQuery = encodeURIComponent(query);
//     const offsets = [0 , 10 , 20]
//     // هنبعت الريكوست اللى هنسحب بيه لسبوتيفاى
//     const pages = await Promise.all(offsets.map(offset => 
//         fetch(`${SPOTIFY_API_URL}/v1/search?q=${encodedQuery}&type=track&limit=${limit}&offset=${offset}&market=US`, {
//             headers: { 'Authorization': `Bearer ${token}` }
//         }).then(async res => {
//             if (!res.ok) {
//                 console.error(`Spotify error: ${res.status}`, await res.text());
//                 return [];
//             }
//             const data = await res.json();
//             return data.tracks?.items || [];
//         })
//     ));

//     // هنظبط الداتا وناخد بس اللى محتاجينه عشان منملاش مساحة على الفاضى
//     return pages.flat()
//         .filter(track => track && track.id)
//         .map(track => ({
//             id: track.id,
//             name: track.name,
//             artist: track.artists.map(a => a.name).join(', ') || "Unknown",
//             popularity: track.popularity
//         }));
// }

const fetchTracksDirectly = async (query, token, offset = 0) => {
    const encodedQuery = encodeURIComponent(query);
    const url = `${SPOTIFY_API_URL}/v1/search?q=${encodedQuery}&type=track&market=EG&limit=10&offset=${offset}`;
    
    console.log("Fetching:", url); 

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        console.error(`Spotify error ${res.status}:`, await res.text());
        return [];
    }

    const data = await res.json();
    
    console.log("Raw response tracks count:", data.tracks?.items?.length); 
    
    return (data.tracks?.items || [])
        .filter(track => track && track.id)
        .map(track => ({
            id: track.id,
            name: track.name,
            artist: track.artists?.map(a => a.name).join(', ') || "Unknown",
            popularity: track.popularity ?? 0
        }));
};

// دى بقا الفانكشن اللى هتجمع كله مع بعض والكنترولر بتاعنا يكلمها 
export const mineTrackPool = async (vibe , genres , era , token) => {
    // نجهز كلمات البحث بالعربى والانجليزى عادى
    const cleanVibe = vibe.split(' ')[0]; 
    const mainGenre = genres[0] || 'Pop';

    const arabicGenres = {
        'Rap': 'راب مصري',
        'Hip-Hop': 'تراب هيب هوب',
        'Pop': 'اغاني عربية بوب',
        'Indie': 'اندي عربي'
    };
    const arabicVibes = {
        'Chill': 'روقان هادي',
        'Night': 'طريق سفر',
        'Party': 'سهرة حفلة',
        'Beast': 'جيم تمرين',
        'Heartbreak': 'حزين دراما'
    };

    const arGenre = arabicGenres[mainGenre] || 'عربي';
    const arVibe = arabicVibes[cleanVibe] || '';


    const queries = [
        `genre:${mainGenre}`,                 
        `${cleanVibe} ${mainGenre}`,   
        `${arGenre} ${arVibe}`,   
        `اغاني ${arGenre}`             
    ];

    // لو اليوزر مختار حقبة زمنية معينة (زي التسعينات)، هنلزق فلتر الـ year
    const yearFilter = era !== 'Anything' ? ` year:${era}` : '';
    const finalQueries = queries.map(q => `${q}${yearFilter}`);

    console.log("Running Spotify Queries:", finalQueries);
    
    // نضرب الـ 4 ريكويستات في نفس الوقت (Parallel)
    const trackPromises = finalQueries.flatMap(q => [
        fetchTracksDirectly(q, token, 0),
        fetchTracksDirectly(q, token, 10),
        fetchTracksDirectly(q, token, 20),
    ]);
    const tracksArrays = await Promise.all(trackPromises);
    
    //  ندمج الـ 4 مصفوفات ونشيل الأغاني المتكررة
    const rawPool = tracksArrays.flat();
    const uniquePool = Array.from(new Map(rawPool.map(track => [track.id, track])).values());

    //  نرتبهم حسب الأكثر استماعاً (Popularity) وناخد أفضل 150 أغنية نبعتهم للـ AI
    return uniquePool.sort((a, b) => b.popularity - a.popularity).slice(0, 150);
}