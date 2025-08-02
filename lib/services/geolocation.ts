import { QdrantClient } from '@qdrant/js-client-rest';

interface GeolocationData {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  datacenter: string;
  isp: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  asn?: string;
  cached?: boolean;
  source?: string;
}

interface GeolocationProvider {
  name: string;
  url: (ip: string) => string;
  headers?: Record<string, string>;
  rateLimit: number; // requests per hour
  parse: (data: any) => GeolocationData;
  validate: (data: any) => boolean;
}

class GeolocationService {
  private qdrant: QdrantClient;
  private collectionName = 'ip_geolocation';
  private providers: GeolocationProvider[];

  constructor() {
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });

    this.providers = [
      // IPGeolocation.io - 1000 requests/day free, very reliable
      {
        name: 'ipgeolocation.io',
        url: (ip: string) => `https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.IPGEOLOCATION_API_KEY}&ip=${ip}`,
        rateLimit: 1000,
        validate: (data: any) => !data.message && data.country_name,
        parse: (data: any) => ({
          country: data.country_name || 'Unknown',
          countryCode: data.country_code2 || 'XX',
          region: data.state_prov || 'Unknown',
          city: data.city || 'Unknown',
          datacenter: data.organization || data.isp || 'Unknown',
          isp: data.isp || 'Unknown',
          lat: parseFloat(data.latitude) || undefined,
          lon: parseFloat(data.longitude) || undefined,
          timezone: data.time_zone?.name,
          asn: data.asn,
          source: 'ipgeolocation.io'
        })
      },

      // IPStack - 10,000 requests/month free, very reliable
      {
        name: 'ipstack',
        url: (ip: string) => `http://api.ipstack.com/${ip}?access_key=${process.env.IPSTACK_API_KEY}`,
        rateLimit: 10000,
        validate: (data: any) => !data.error && data.country_name,
        parse: (data: any) => ({
          country: data.country_name || 'Unknown',
          countryCode: data.country_code || 'XX',
          region: data.region_name || 'Unknown',
          city: data.city || 'Unknown',
          datacenter: data.connection?.isp || 'Unknown',
          isp: data.connection?.isp || 'Unknown',
          lat: data.latitude || undefined,
          lon: data.longitude || undefined,
          timezone: data.time_zone?.id,
          source: 'ipstack'
        })
      },

      // AbstractAPI - 20,000 requests/month free
      {
        name: 'abstractapi',
        url: (ip: string) => `https://ipgeolocation.abstractapi.com/v1/?api_key=${process.env.ABSTRACT_API_KEY}&ip_address=${ip}`,
        rateLimit: 20000,
        validate: (data: any) => !data.error && data.country,
        parse: (data: any) => ({
          country: data.country || 'Unknown',
          countryCode: data.country_code || 'XX',
          region: data.region || 'Unknown',
          city: data.city || 'Unknown',
          datacenter: data.connection?.autonomous_system_organization || 'Unknown',
          isp: data.connection?.isp_name || 'Unknown',
          lat: parseFloat(data.latitude) || undefined,
          lon: parseFloat(data.longitude) || undefined,
          timezone: data.timezone?.name,
          source: 'abstractapi'
        })
      },

      // MaxMind GeoLite2 (if we have a license)
      {
        name: 'maxmind',
        url: (ip: string) => `https://geoip.maxmind.com/geoip/v2.1/city/${ip}?demo=1`,
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.MAXMIND_USER_ID}:${process.env.MAXMIND_LICENSE_KEY}`).toString('base64')}`
        },
        rateLimit: 1000,
        validate: (data: any) => data.country && !data.error,
        parse: (data: any) => ({
          country: data.country?.names?.en || 'Unknown',
          countryCode: data.country?.iso_code || 'XX',
          region: data.subdivisions?.[0]?.names?.en || 'Unknown',
          city: data.city?.names?.en || 'Unknown',
          datacenter: data.traits?.organization || 'Unknown',
          isp: data.traits?.isp || 'Unknown',
          lat: data.location?.latitude || undefined,
          lon: data.location?.longitude || undefined,
          timezone: data.location?.time_zone,
          source: 'maxmind'
        })
      },

      // Fallback to free services
      {
        name: 'ipapi.co',
        url: (ip: string) => `https://ipapi.co/${ip}/json/`,
        headers: { 'User-Agent': 'OpenSVM-Analytics/1.0' },
        rateLimit: 1000,
        validate: (data: any) => !data.error && data.country_name,
        parse: (data: any) => ({
          country: data.country_name || 'Unknown',
          countryCode: data.country_code || 'XX',
          region: data.region || 'Unknown',
          city: data.city || 'Unknown',
          datacenter: data.org || 'Unknown',
          isp: data.org || 'Unknown',
          lat: data.latitude || undefined,
          lon: data.longitude || undefined,
          timezone: data.timezone,
          source: 'ipapi.co'
        })
      },

      {
        name: 'ip-api.com',
        url: (ip: string) => `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`,
        headers: { 'User-Agent': 'OpenSVM-Analytics/1.0' },
        rateLimit: 1000,
        validate: (data: any) => data.status === 'success',
        parse: (data: any) => ({
          country: data.country || 'Unknown',
          countryCode: data.countryCode || 'XX',
          region: data.regionName || 'Unknown',
          city: data.city || 'Unknown',
          datacenter: data.org || data.isp || 'Unknown',
          isp: data.isp || 'Unknown',
          lat: data.lat || undefined,
          lon: data.lon || undefined,
          timezone: data.timezone,
          asn: data.as,
          source: 'ip-api.com'
        })
      }
    ];
  }

  async initializeCollection(): Promise<void> {
    try {
      // Check if collection exists
      const collections = await this.qdrant.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);

      if (!exists) {
        await this.qdrant.createCollection(this.collectionName, {
          vectors: {
            size: 4, // [lat, lon, country_code_hash, region_hash]
            distance: 'Cosine'
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });

        // Create index for faster IP lookups
        await this.qdrant.createPayloadIndex(this.collectionName, {
          field_name: 'ip',
          field_schema: 'keyword'
        });

        console.log(`Created Qdrant collection: ${this.collectionName}`);
      }
    } catch (error) {
      console.error('Failed to initialize Qdrant collection:', error);
    }
  }

  private ipToVector(ip: string, geoData: GeolocationData): number[] {
    console.log(`Creating vector representation for IP ${ip}`);

    // Create a comprehensive vector representation using both IP and geo data
    const lat = geoData.lat || 0;
    const lon = geoData.lon || 0;
    const countryHash = this.stringToHash(geoData.countryCode) / 1000000;
    const regionHash = this.stringToHash(geoData.region) / 1000000;

    // Use IP address for additional vector dimensions
    const ipParts = ip.split('.').map(part => parseInt(part, 10) || 0);
    const ipHash = this.stringToHash(ip) / 1000000;

    // Create normalized IP components
    const ipVector = ipParts.map(part => part / 255); // Normalize to [0, 1]

    console.log(`Vector created for ${ip}: geo=[${lat / 90}, ${lon / 180}], country=${countryHash}, region=${regionHash}, ip=[${ipVector.join(', ')}]`);

    return [
      lat / 90,           // Normalized latitude
      lon / 180,          // Normalized longitude
      countryHash,        // Country code hash
      regionHash,         // Region hash
      ...ipVector,        // IP octets normalized
      ipHash              // IP string hash
    ];
  }

  private stringToHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async getCachedGeolocation(ip: string): Promise<GeolocationData | null> {
    try {
      const results = await this.qdrant.search(this.collectionName, {
        vector: [0, 0, 0, 0], // Dummy vector, we'll filter by IP
        filter: {
          must: [
            {
              key: 'ip',
              match: { value: ip }
            }
          ]
        },
        limit: 1,
        with_payload: true
      });

      if (results.length > 0) {
        const payload = results[0].payload as any;

        // Check if cache is still valid (24 hours)
        const cacheAge = Date.now() - payload.cached_at;
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return {
            ...payload.geolocation,
            cached: true
          };
        }
      }
    } catch (error) {
      console.error('Failed to retrieve cached geolocation:', error);
    }

    return null;
  }

  async cacheGeolocation(ip: string, geoData: GeolocationData): Promise<void> {
    try {
      const vector = this.ipToVector(ip, geoData);
      const pointId = this.stringToHash(ip);

      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        points: [
          {
            id: pointId,
            vector,
            payload: {
              ip,
              geolocation: geoData,
              cached_at: Date.now(),
              source: geoData.source
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to cache geolocation:', error);
    }
  }

  async fetchFromProvider(provider: GeolocationProvider, ip: string): Promise<GeolocationData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(provider.url(ip), {
        headers: {
          'User-Agent': 'OpenSVM-Analytics/1.0',
          ...provider.headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`${provider.name} failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!provider.validate(data)) {
        throw new Error(`${provider.name} returned invalid data: ${JSON.stringify(data)}`);
      }

      return provider.parse(data);
    } catch (error) {
      clearTimeout(timeoutId);
      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new Error(`${provider.name} request timed out`);
      }
      throw error;
    }
  }

  async getGeolocation(ip: string): Promise<GeolocationData> {
    // First, try to get from cache
    const cached = await this.getCachedGeolocation(ip);
    if (cached) {
      return cached;
    }

    // Try providers in order of preference (paid services first)
    const errors: string[] = [];

    for (const provider of this.providers) {
      try {
        const result = await this.fetchFromProvider(provider, ip);

        // Cache the successful result
        await this.cacheGeolocation(ip, result);

        console.log(`Successfully geocoded ${ip} using ${provider.name}`);
        return result;
      } catch (error) {
        const err = error as Error;
        const errorMsg = `${provider.name}: ${err.message}`;
        errors.push(errorMsg);
        console.warn(`Geolocation provider ${provider.name} failed for ${ip}:`, err.message);

        // Add delay between providers to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // All providers failed, return fallback data
    console.error(`All geolocation providers failed for ${ip}:`, errors);

    const fallbackData: GeolocationData = {
      country: 'Unknown',
      countryCode: 'XX',
      region: 'Unknown',
      city: 'Unknown',
      datacenter: 'Unknown',
      isp: 'Unknown',
      source: 'fallback'
    };

    // Cache the fallback data with shorter TTL
    await this.cacheGeolocation(ip, fallbackData);

    return fallbackData;
  }

  async batchGeolocation(ips: string[]): Promise<Map<string, GeolocationData>> {
    const results = new Map<string, GeolocationData>();
    const uncachedIps: string[] = [];

    // First, get all cached results
    for (const ip of ips) {
      const cached = await this.getCachedGeolocation(ip);
      if (cached) {
        results.set(ip, cached);
      } else {
        uncachedIps.push(ip);
      }
    }

    // Process uncached IPs with rate limiting
    const batchSize = 5; // Process 5 IPs at a time
    const delay = 1000; // 1 second delay between batches

    for (let i = 0; i < uncachedIps.length; i += batchSize) {
      const batch = uncachedIps.slice(i, i + batchSize);

      const batchPromises = batch.map(async (ip) => {
        try {
          const result = await this.getGeolocation(ip);
          results.set(ip, result);
        } catch (error) {
          console.error(`Failed to geocode ${ip}:`, error);
          results.set(ip, {
            country: 'Unknown',
            countryCode: 'XX',
            region: 'Unknown',
            city: 'Unknown',
            datacenter: 'Unknown',
            isp: 'Unknown',
            source: 'error'
          });
        }
      });

      await Promise.all(batchPromises);

      // Add delay between batches
      if (i + batchSize < uncachedIps.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return results;
  }

  async getStats(): Promise<{
    totalCached: number;
    cacheHitRate: number;
    providerStats: Record<string, number>;
  }> {
    try {
      const info = await this.qdrant.getCollection(this.collectionName);
      const totalCached = info.points_count || 0;

      // Get provider distribution from recent cache entries
      const recentResults = await this.qdrant.search(this.collectionName, {
        vector: [0, 0, 0, 0],
        limit: 1000,
        with_payload: true
      });

      const providerStats: Record<string, number> = {};
      for (const result of recentResults) {
        const source = (result.payload as any)?.source || 'unknown';
        providerStats[source] = (providerStats[source] || 0) + 1;
      }

      return {
        totalCached,
        cacheHitRate: 0, // Would need to track this separately
        providerStats
      };
    } catch (error) {
      console.error('Failed to get geolocation stats:', error);
      return {
        totalCached: 0,
        cacheHitRate: 0,
        providerStats: {}
      };
    }
  }
}

// Singleton instance
let geolocationService: GeolocationService | null = null;

export async function getGeolocationService(): Promise<GeolocationService> {
  if (!geolocationService) {
    geolocationService = new GeolocationService();
    await geolocationService.initializeCollection();
  }
  return geolocationService;
}

export { GeolocationService, type GeolocationData };