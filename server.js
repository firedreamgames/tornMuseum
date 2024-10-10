const path = require("path");
const fastify = require("fastify")({
  logger: true, // Enable logging for better troubleshooting
});
const axios = require("axios");
require('dotenv').config(); // Load environment variables from .env file

// Log environment variables to verify
console.log('User:', process.env.BASIC_AUTH_USER);
console.log('Password:', process.env.BASIC_AUTH_PASSWORD);

// Setup static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
  root: path.join(__dirname, 'src/pages')
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

// Register basic authentication plugin
fastify.register(require('@fastify/basic-auth'), {
  validate,
  authenticate: true,
});

// Authentication validation function
async function validate(username, password, req, reply) {
  if (username !== process.env.BASIC_AUTH_USER || password !== process.env.BASIC_AUTH_PASSWORD) {
    throw new Error('Unauthorized');
  }
}

// Home page route
fastify.get("/", function (request, reply) {
  let params = { seo: seo };

  if (request.query.randomize) {
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];
    params = {
      color: colors[currentColor],
      colorError: null,
      seo: seo,
    };
  }

  return reply.view("index.hbs", params);
});

// Route to fetch points market data
fastify.post('/fetch-points-price', async function (request, reply) {
    const apiKey = request.body.apiKey;
    const APIurl = `https://api.torn.com/market/?selections=pointsmarket&key=${apiKey}`;

    try {
        const response = await axios.get(APIurl, {
            headers: {
                'Accept-Encoding': 'application/json',
            }
        });

        const pointsData = response.data.pointsmarket;
        let pts = Object.values(pointsData).reduce((prev, curr) => {
            return prev.cost < curr.cost ? prev : curr;
        });
        let pointPrice = pts.cost;

        return reply.send({ success: true, pointPrice });
    } catch (error) {
        fastify.log.error(`Error fetching points market data: ${error}`);
        return reply.status(500).send({ error: "Failed to fetch points market data" });
    }
});

// Route to validate API key
fastify.post("/validate-api-key", async function (request, reply) {
  const apiKey = request.body.apiKey;

  if (!apiKey) {
    return reply.status(400).send({ error: "API key is required" });
  }

  const APIurl = `https://api.torn.com/user/?selections=basic&key=${apiKey}`;

  try {
    const response = await axios.get(APIurl, {
      headers: {
        'Accept-Encoding': 'application/json',
      }
    });

    const data = response.data;

    if (!data.player_id || !data.name) {
      return reply.status(400).send({ error: "Invalid API key" });
    }

    return reply.send({ success: `Welcome ${data.name}` });

  } catch (error) {
    fastify.log.error(`Error validating API key: ${error.message}`);
    return reply.status(500).send({ error: "Failed to validate API key" });
  }
});

// Run the server and report out to the logs
fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Your app is listening on ${address}`);
});
