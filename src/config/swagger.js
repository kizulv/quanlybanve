import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "VinaBus Manager API",
      version: "1.0.0",
      description: "Tài liệu API cho ứng dụng VinaBus Manager",
      contact: {
        name: "VinaBus Support",
      },
    },
    servers: [
      {
        url: "http://localhost:5001/api",
        description: "Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"], // Path to the API docs
};

export const specs = swaggerJsdoc(options);
