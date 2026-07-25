import api from './client'

export interface GeotagsResponse {
  geoip: string[]
  geosite: string[]
}

export const routingApi = {
  isEnabled: () =>
    api.get<boolean>('/routing/enabled'),

  getConfig: () =>
    api.get<string>('/routing/config'),

  create: (xrayJson: string) =>
    api.post<string>('/routing/config', JSON.stringify(xrayJson)),

  update: (xrayJson: string) =>
    api.put<string>('/routing/config', JSON.stringify(xrayJson)),

  delete: () =>
    api.delete('/routing/config'),

  logs: () =>
    api.get<string>('/routing/logs'),

  getGeotags: () =>
    api.get<GeotagsResponse>('/routing/geotags'),
}
