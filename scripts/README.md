# API Type Generation

This directory contains scripts for automatically generating TypeScript types from your API documentation.

## How it works

1. **Export your Postman collection** as JSON and place it in `scripts/verible-api-collection.json`
2. **Run development server**: `npm run dev` (automatically generates types first)
3. **Types are automatically generated** in `entrypoints/popup/types/api.ts`

## Automatic Type Generation

✅ **Every time you run `npm run dev`** - Types are generated first  
✅ **Every time you build** - Types are generated first  
✅ **Always up-to-date** - No manual steps required  

## Setup

### Option 1: Using Postman Collection (Recommended)

1. Go to your Postman workspace
2. Click on your Verible API collection
3. Click "Export" → "Collection v2.1" → "Download"
4. Save the file as `scripts/verible-api-collection.json`
5. Run `npm run generate-types`

### Option 2: Using Basic OpenAPI Spec

If you don't have a Postman collection exported, the script will create a basic OpenAPI specification based on your API endpoints and generate types from that.

## Generated Files

- `scripts/verible-api-openapi.json` - OpenAPI specification
- `entrypoints/popup/types/api.ts` - Generated TypeScript types

## Benefits

✅ **Always in sync** - Types are generated from your actual API documentation  
✅ **No manual maintenance** - Types update automatically when API changes  
✅ **Type safety** - Full TypeScript support for all API endpoints  
✅ **Auto-completion** - IDE support for API requests and responses  
✅ **TypeScript script** - The generation script itself is written in TypeScript for better type safety  

## Updating Types

Whenever you update your API:

1. Export the updated Postman collection to `scripts/verible-api-collection.json`
2. Run `npm run dev` (types are generated automatically)
3. Types are automatically updated!

## Script Details

The `generate-types.ts` script:

1. Converts Postman collection to OpenAPI specification
2. Generates TypeScript types from OpenAPI spec
3. Saves types to the correct location for your extension
4. Provides helpful error messages and guidance
