import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type definitions for better type safety
interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components?: {
    securitySchemes?: Record<string, any>;
  };
}

interface ApiConfig {
  baseUrl: string;
  docsUrl: string;
}

interface TypeGenerationResult {
  success: boolean;
  typesPath?: string;
  error?: string;
}

async function generateTypes(): Promise<TypeGenerationResult> {
  try {
    // Load environment variables with proper typing
    const config: ApiConfig = {
      baseUrl: process.env.VITE_API_BASE_URL || 'https://verible-backend.vercel.app',
      docsUrl: process.env.VITE_API_DOCS_URL || 'https://documenter.getpostman.com/view/36179911/2sB3QMK8Z5'
    };
    
    console.log('🔄 Generating TypeScript types from API documentation...');
    console.log(`📡 API Base URL: ${config.baseUrl}`);
    console.log(`📚 API Docs URL: ${config.docsUrl}`);
    
    // Step 1: Check for Postman collection or existing OpenAPI file
    const collectionPath = path.join(__dirname, 'verible-api-collection.json');
    const openApiPath = path.join(__dirname, 'verible-api-openapi.json');
    
    // Step 2: Create OpenAPI specification
    console.log('🔄 Creating OpenAPI specification...');
    
    // Check if OpenAPI file exists and if it's valid OpenAPI format
    let needsConversion = false;
    if (fs.existsSync(openApiPath)) {
      try {
        const existingContent = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
        // Check if it's a valid OpenAPI spec (has 'openapi' field) or if it's a Postman collection
        if (!existingContent.openapi && (existingContent.info?._postman_id || existingContent.item)) {
          console.log('📝 Existing file is a Postman collection, converting to OpenAPI...');
          needsConversion = true;
          // Backup the original file
          const backupPath = path.join(__dirname, 'verible-api-collection.json');
          fs.writeFileSync(backupPath, JSON.stringify(existingContent, null, 2));
        } else if (!existingContent.openapi) {
          console.log('⚠️  Existing file is not a valid OpenAPI spec, will recreate...');
          needsConversion = true;
        } else {
          console.log('✅ Valid OpenAPI spec found, skipping conversion');
        }
      } catch (error) {
        console.log('⚠️  Error reading existing file, will recreate...');
        needsConversion = true;
      }
    }
    
    // Convert Postman collection to OpenAPI if needed
    if (needsConversion) {
      // If the OpenAPI file is actually a Postman collection, move it to collection path first
      if (fs.existsSync(openApiPath) && !fs.existsSync(collectionPath)) {
        const existingContent = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
        if (existingContent.info?._postman_id || existingContent.item) {
          console.log('📦 Moving Postman collection to proper location...');
          fs.writeFileSync(collectionPath, JSON.stringify(existingContent, null, 2));
        }
      }
      
      if (fs.existsSync(collectionPath)) {
        try {
          // Use postman-to-openapi programmatically
          const require = createRequire(import.meta.url);
          const postmanToOpenApi = require('postman-to-openapi');
          
          // Use a temporary file for conversion to avoid overwriting issues
          const tempOpenApiPath = openApiPath + '.tmp';
          await postmanToOpenApi(collectionPath, tempOpenApiPath, {
            info: {
              title: "Verible API",
              version: "1.1.6",
              description: "Verible Backend API"
            },
            servers: [{
              url: config.baseUrl,
              description: "Production server"
            }]
          });
          
          if (fs.existsSync(tempOpenApiPath)) {
            fs.renameSync(tempOpenApiPath, openApiPath);
            console.log('✅ OpenAPI spec generated from Postman collection');
            needsConversion = false;
          } else {
            throw new Error('Conversion did not produce output file');
          }
        } catch (error) {
          console.log('⚠️  Postman-to-OpenAPI conversion failed, creating basic spec...');
          if (error instanceof Error) {
            console.log(`   Error: ${error.message}`);
          }
          needsConversion = true; // Still need to create basic spec
        }
      }
    }
    
    if (!fs.existsSync(openApiPath) || needsConversion) {
      console.log('📝 Creating basic OpenAPI specification...');
      
      const basicOpenApiSpec: OpenApiSpec = {
        openapi: "3.0.0",
        info: {
          title: "Verible API",
          version: "1.1.6",
          description: "Verible Backend API"
        },
        servers: [
          {
            url: config.baseUrl,
            description: "Production server"
          }
        ],
        paths: {
          "/": {
            get: {
              summary: "Health check",
              responses: {
                "200": {
                  description: "API health status",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          message: { type: "string" },
                          version: { type: "string" },
                          timestamp: { type: "string" }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "/api/auth/login": {
            post: {
              summary: "User login",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        email: { type: "string", format: "email" },
                        password: { type: "string" }
                      },
                      required: ["email", "password"]
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Login successful",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          data: {
                            type: "object",
                            properties: {
                              user: {
                                type: "object",
                                properties: {
                                  id: { type: "string" },
                                  email: { type: "string" },
                                  name: { type: "string" },
                                  avatar: { type: "string" }
                                }
                              },
                              token: { type: "string" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "/api/auth/register": {
            post: {
              summary: "User registration",
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        email: { type: "string", format: "email" },
                        password: { type: "string" },
                        name: { type: "string" }
                      },
                      required: ["email", "password", "name"]
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Registration successful",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          data: {
                            type: "object",
                            properties: {
                              user: {
                                type: "object",
                                properties: {
                                  id: { type: "string" },
                                  email: { type: "string" },
                                  name: { type: "string" },
                                  avatar: { type: "string" }
                                }
                              },
                              token: { type: "string" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "/api/analysis/seller": {
            post: {
              summary: "Analyze seller trustworthiness",
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        platform: { type: "string" },
                        price: { type: "string" },
                        location: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["name", "platform"]
                    }
                  }
                }
              },
              responses: {
                "200": {
                  description: "Analysis successful",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean" },
                          data: {
                            type: "object",
                            properties: {
                              score: { type: "number", minimum: 0, maximum: 100 },
                              riskLevel: { type: "string", enum: ["Trusted", "Uncertain", "Avoid"] },
                              confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                              reasons: { type: "array", items: { type: "string" } },
                              timestamp: { type: "string" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT"
            }
          }
        }
      };
      
      fs.writeFileSync(openApiPath, JSON.stringify(basicOpenApiSpec, null, 2));
      console.log('✅ Basic OpenAPI spec created');
    }
    
    // Step 3: Generate TypeScript types from OpenAPI
    console.log('🔄 Generating TypeScript types...');
    const typesPath = path.join(__dirname, '..', 'entrypoints', 'popup', 'types', 'api.ts');
    
    // Ensure types directory exists
    const typesDir = path.dirname(typesPath);
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }
    
    try {
      execSync(`npx openapi-typescript ${openApiPath} -o ${typesPath}`, { stdio: 'inherit' });
      console.log('✅ TypeScript types generated successfully!');
      console.log(`📁 Types saved to: ${typesPath}`);
      
      return {
        success: true,
        typesPath
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('❌ Failed to generate types:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error generating types:', errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('generate-types.ts')) {
  generateTypes().then((result) => {
    if (result.success) {
      console.log('🎉 Type generation completed successfully!');
      process.exit(0);
    } else {
      console.error('💥 Type generation failed:', result.error);
      process.exit(1);
    }
  }).catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { generateTypes, type OpenApiSpec, type ApiConfig, type TypeGenerationResult };
