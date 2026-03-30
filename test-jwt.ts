import { google } from 'googleapis';
const jwtClient = new google.auth.JWT({
  email: 'test@example.com',
  key: 'private_key',
  scopes: ['https://www.googleapis.com/auth/indexing'],
});
