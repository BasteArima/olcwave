import api from './client'

export const routingApi = {
  isEnabled: () =>
    api.get<boolean>('/routing/enabled'),

  getConfig: () =>
    api.get<string>('/routing/config'),

  create: (xrayJson: string) =>
    api.post<string>('/routing/config', null, { params: { xray_json: xrayJson } }),

  update: (xrayJson: string) =>
    api.put<string>('/routing/config', null, { params: { xray_json: xrayJson } }),

  delete: () =>
    api.delete('/routing/config'),

  logs: () =>
    api.get<string>('/routing/logs'),
}
