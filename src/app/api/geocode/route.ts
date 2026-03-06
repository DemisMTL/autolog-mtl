import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
        return NextResponse.json({ name: 'Posizione sconosciuta' }, { status: 400 });
    }

    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    // 1. Tenta con Google Places API (Nearby Search) se la chiave è configurata
    if (mapsKey) {
        try {
            const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=150&rankby=distance&key=${mapsKey}&language=it`;
            const placesRes = await fetch(placesUrl);
            const placesData = await placesRes.json();

            if (placesData.status === 'OK' && placesData.results?.length > 0) {
                // Filtra per tipo: esclude luoghi generici come route, political
                const skip = new Set(['route', 'political', 'country', 'locality', 'sublocality', 'postal_code']);
                const best = placesData.results.find((p: any) =>
                    !p.types.every((t: string) => skip.has(t))
                );
                if (best) {
                    const name = best.name;
                    // Adds the address for context if short
                    const addr = best.vicinity ? ` — ${best.vicinity}` : '';
                    return NextResponse.json({ name: `${name}${addr}`, source: 'google' });
                }
            }
        } catch (err) {
            console.warn('Google Places API error, falling back:', err);
        }
    }

    // 2. Fallback: OpenStreetMap Nominatim (gratuito, no key)
    try {
        const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`;
        const osmRes = await fetch(osmUrl, {
            headers: { 'Accept-Language': 'it', 'User-Agent': 'AutoLogApp/1.0' }
        });
        const osmData = await osmRes.json();
        const a = osmData.address;

        // Prova prima il nome del luogo (negozio, edificio, ecc.)
        const placeName = a?.amenity || a?.shop || a?.building || a?.industrial || a?.office;
        if (placeName) {
            const street = [a?.road, a?.house_number].filter(Boolean).join(' ');
            const city = a?.city || a?.town || a?.village || '';
            return NextResponse.json({ name: `${placeName}${street ? ' — ' + street : ''}${city ? ', ' + city : ''}`, source: 'osm' });
        }

        // Altrimenti usa via + città
        const street = [a?.road, a?.house_number].filter(Boolean).join(' ');
        const city = a?.city || a?.town || a?.village || a?.municipality || '';
        const address = [street, city].filter(Boolean).join(', ') || osmData.display_name;
        return NextResponse.json({ name: address, source: 'osm' });
    } catch {
        return NextResponse.json({ name: `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`, source: 'coords' });
    }
}
