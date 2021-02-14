/* eslint-disable no-undef */
const orm = require('../lib/orm');
const storage = require('../lib/storage');
const bus = require('../lib/bus');
const { WorkerSchema } = require('../worker/worker.model');
const { TaskSchema } = require('../tasks/task.model');
const workerServer = require('../worker/server');
const FormData = require('form-data');
const fs = require('fs');
const { truncate } = require('../worker/worker');
const http = require('http');
const path = require('path');

const querystring = require('querystring');
const ERROR_WORKER_NOT_FOUND = 'pekerja tidak ditemukan';

function request(options, form = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      if (res.statusCode === 404) {
        reject(ERROR_WORKER_NOT_FOUND);
      }
      res.on('data', (chunk) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        resolve(data);
      });
      res.on('error', (err) => {
        reject((err && err.message) || err.toString());
      });
    });
    req.on('error', (error) => {
      console.error(error);
    });

    if (form) {
      form.pipe(req);
      req.on('response', function (res) {
        console.log(res.statusCode);
      });
    } else {
      req.end();
    }
  });
}

describe('worker', () => {
  let connection;
  beforeAll(async () => {
    try {
      connection = await orm.connect([WorkerSchema, TaskSchema], {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'passpostgres1997',
        database: 'sanbercode2',
      });
    } catch (err) {
      console.error('database connection failed');
    }
    try {
      await storage.connect('task-manager', {
        endPoint: '127.0.0.1',
        port: 1111,
        useSSL: false,
        accessKey: 'minio',
        secretKey: '12345678',
      });
    } catch (err) {
      console.error('object storage connection failed');
    }
    try {
      await bus.connect();
    } catch (err) {
      console.error('message bus connection failed');
    }
    workerServer.run();
  });
  // beforeEach(async () => {
  //   await truncate();
  // });
  afterAll(async () => {
    await truncate();
    await connection.close();
    bus.close();
    workerServer.stop();
  });

  describe('worker', () => {
    it('register worker', async () => {
      const form = new FormData();
      form.append('name', 'Moh. Ilham Burhanuddin');
      form.append('age', 23);
      form.append('bio', 'Ini adalah bio ilham');
      form.append('address', 'Bangkalan');
      form.append(
        'photo',
        fs.createReadStream(path.resolve(__dirname, 'gambar1.jpeg'))
      );

      const response = await new Promise((resolve, reject) => {
        form.submit('http://localhost:7001/register', function (err, res) {
          if (err) {
            reject(err);
          }
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            resolve(data);
          });
        });
      });

      const data = JSON.parse(response);
      expect(data.name).toBe('Moh. Ilham Burhanuddin');
    });

    it('list worker', async () => {
      const options = {
        hostname: 'localhost',
        port: 7001,
        path: '/list',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const response = await request(options);
      const data = JSON.parse(response);
      expect(data).toHaveLength(1);
    });

    it('info worker', async () => {
      const get_worker = await request({
        hostname: 'localhost',
        port: 7001,
        path: '/list',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const data = JSON.parse(get_worker)[0];

      const param = querystring.stringify({
        id: data.id,
      });
      const response = await request({
        hostname: 'localhost',
        port: 7001,
        path: `/info?${param}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const result = JSON.parse(response);
      expect(result).toStrictEqual(data);
    });

    it('remove worker', async () => {
      const getoptions = {
        hostname: 'localhost',
        port: 7001,
        path: '/list',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const getdata = await request(getoptions);
      const id = JSON.parse(getdata)[0];
      const postData = querystring.stringify({
        id: id.id,
      });

      const options = {
        hostname: 'localhost',
        port: 7001,
        path: `/remove?${postData}`,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      };

      const response = await request(options);
      const result = JSON.parse(response);
      expect(result).toStrictEqual(JSON.parse(getdata)[0]);
    });
  });
});
