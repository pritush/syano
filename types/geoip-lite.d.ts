declare module 'geoip-lite' {
  export type GeoLocation = {
    range?: [number, number]
    country?: string
    region?: string
    eu?: string | number
    timezone?: string
    city?: string
    ll?: [number | null, number | null]
    metro?: number
    area?: number
  }

  const geoip: {
    lookup(ip: string): GeoLocation | null
  }

  export default geoip
}
