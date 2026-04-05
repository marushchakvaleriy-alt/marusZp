import { api } from '../../shared/api';

export async function fetchTeamUsers() {
  const response = await api.get('/users');
  return response.data;
}

export async function createTeamUser(payload) {
  const response = await api.post('/users', payload);
  return response.data;
}

export async function updateTeamUser(userId, payload) {
  const response = await api.patch(`/users/${userId}`, payload);
  return response.data;
}

export async function deleteTeamUser(userId) {
  const response = await api.delete(`/users/${userId}`);
  return response.data;
}
