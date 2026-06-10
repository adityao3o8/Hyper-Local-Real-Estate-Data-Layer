export interface AmenityBreakdown {
  hospital: number;
  school: number;
  park: number;
  metro: number;
}

export interface PriceMention {
  raw: string;
  amount_inr: number | null;
  unit: string;
  source_title: string;
  source_link: string;
}

export interface PriceBand {
  min: number;
  max: number;
  median: number;
  sample_count: number;
}

export interface PropertyPricesSummary {
  locality: string;
  query: string;
  source: string;
  price_mentions: PriceMention[];
  total_price_inr?: PriceBand;
  per_sqft_inr?: PriceBand;
  error?: string;
}

export interface ReportResponse {
  locality: string;
  neighbourhood_score: number;
  rera_score: number;
  amenity_score: number;
  amenity_breakdown: AmenityBreakdown;
  rera_projects_matched: number;
  avg_complaints: number | null;
  centre: { lat: number; lon: number };
  ai_report: string;
  amenities?: MapAmenity[];
  property_prices?: PropertyPricesSummary;
}

export interface LocalitySummary {
  locality: string;
  neighbourhood_score: number;
  rera_score: number;
  amenity_score: number;
}

export interface LocalitiesResponse {
  count: number;
  localities: LocalitySummary[];
}

export interface MapAmenity {
  lat: number;
  lon: number;
  name: string;
  category: "hospital" | "school" | "park" | "metro";
}

export interface AmenitiesResponse {
  count: number;
  amenities: MapAmenity[];
}
