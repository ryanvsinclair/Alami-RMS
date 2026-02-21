export type PlacePrediction = {
  place_id: string;
  description: string;
  primary_text: string;
  secondary_text: string;
};

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
};

let scriptPromise: Promise<void> | null = null;

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              request: {
                input: string;
                types: string[];
                region?: string;
                componentRestrictions: { country: string };
              },
              callback: (items: GooglePrediction[] | null) => void
            ) => void;
          };
          PlacesService: new (container: HTMLElement) => {
            getDetails: (
              request: { placeId: string; fields: string[] },
              callback: (result: GooglePlaceResult | null, status: string) => void
            ) => void;
          };
          PlacesServiceStatus: {
            OK: string;
          };
        };
      };
    };
  }
}

type GooglePrediction = {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type GooglePlaceResult = {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
};

export function loadGooglePlaces(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in the browser"));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Places script"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function autocompletePlaces(
  query: string,
  country = "ca"
): Promise<PlacePrediction[]> {
  const googleMaps = window.google?.maps;
  const places = googleMaps?.places;
  if (!places) return [];
  if (!query.trim()) return [];

  const service = new places.AutocompleteService();

  const predictions: GooglePrediction[] = await new Promise((resolve) => {
    service.getPlacePredictions(
      {
        input: query,
        types: ["establishment"],
        region: "ca",
        componentRestrictions: { country },
      },
      (items: GooglePrediction[] | null) => resolve(items ?? [])
    );
  });

  const mapped = predictions.map((item) => ({
    place_id: item.place_id,
    description: item.description,
    primary_text: item.structured_formatting?.main_text ?? item.description,
    secondary_text: item.structured_formatting?.secondary_text ?? "",
  }));

  const canadian = mapped.filter(
    (item) =>
      /,\s*Canada$/i.test(item.description) ||
      /\bCanada\b/i.test(item.secondary_text) ||
      /\bCanada\b/i.test(item.description)
  );

  return canadian.length > 0 ? canadian : mapped;
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const googleMaps = window.google?.maps;
  const places = googleMaps?.places;
  if (!places) {
    throw new Error("Google Places not initialized");
  }

  const container = document.createElement("div");
  const service = new places.PlacesService(container);

  const place = await new Promise<GooglePlaceResult>((resolve, reject) => {
    service.getDetails(
      {
        placeId,
        fields: ["place_id", "name", "formatted_address", "geometry.location"],
      },
      (result: GooglePlaceResult | null, status: string) => {
        if (status !== places.PlacesServiceStatus.OK || !result) {
          reject(new Error("Failed to load place details"));
          return;
        }
        resolve(result);
      }
    );
  });

  const lat = place.geometry?.location?.lat?.();
  const lng = place.geometry?.location?.lng?.();

  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("Place details missing coordinates");
  }

  return {
    place_id: place.place_id,
    name: place.name,
    formatted_address: place.formatted_address,
    lat,
    lng,
  };
}
