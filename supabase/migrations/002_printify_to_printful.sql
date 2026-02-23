-- Rename Printify columns to Printful
ALTER TABLE design_sessions RENAME COLUMN printify_config TO printful_config;
ALTER TABLE design_sessions RENAME COLUMN printify_product_id TO printful_product_id;

-- Drop Printify-specific artifact column
ALTER TABLE artifacts DROP COLUMN IF EXISTS printify_image_id;

-- Drop Printify catalog cache table
DROP TABLE IF EXISTS printify_catalog;
