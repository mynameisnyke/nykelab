import axios from 'axios';
import { IMedia } from '../types/media';

const API_URL = 'http://your-backend-url'; // Replace with your backend URL

export const createMedia = async (media: Partial<IMedia>) => {
  const response = await axios.post(`${API_URL}/media/create`, media);
  return response.data;
};

export const updateMedia = async (id: string, media: Partial<IMedia>) => {
  const response = await axios.put(`${API_URL}/media/update/${id}`, media);
  return response.data;
};

export const getMedia = async (id: string) => {
  const response = await axios.get(`${API_URL}/media/get/${id}`);
  return response.data;
};

export const queryMedia = async (query: any) => {
  const response = await axios.post(`${API_URL}/media/query`, query);
  return response.data;
};

export const copyMediaFile = async (data: any) => {
  const response = await axios.post(`${API_URL}/media/copy`, data);
  return response.data;
};
