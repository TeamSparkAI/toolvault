-- Add pinningInfo column to servers table for storing server pinning information
ALTER TABLE servers ADD COLUMN pinningInfo JSON;
