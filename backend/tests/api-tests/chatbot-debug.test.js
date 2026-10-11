const request = require('supertest');
const app = require('../../server');
const { pool } = require('../../config/database');

describe('DEBUG Chatbot', () => {
  let destId;

  beforeAll(async () => {
    const ts = Date.now();
    const [dest] = await pool.execute(
      `INSERT INTO destinations (name, description, location, category, estimated_budget, recommended_duration, best_time, activities, image_url, nature_score, adventure_score, beach_score, history_score, culture_score, food_score, photography_score, shopping_score) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Chatbot Test Dest', 'Test destination', 'Karnataka', 'Hill Station', 8000, 3, 'September', '["Trekking"]', 'https://test.com', 50, 50, 50, 50, 50, 50, 50, 50]
    );
    destId = dest.insertId;
    console.log('Created destination ID:', destId);
  });

  afterAll(async () => {
    if (destId) await pool.execute('DELETE FROM destinations WHERE id = ?', [destId]);
  });

  test('DEBUG: destination details request', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'Tell me about Chatbot Test Dest' });

    console.log('STATUS:', res.status);
    console.log('BODY:', JSON.stringify(res.body, null, 2));
  });

  test('DEBUG: review query request', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'What is the rating for Chatbot Test Dest?' });

    console.log('STATUS:', res.status);
    console.log('BODY:', JSON.stringify(res.body, null, 2));
  });
});
