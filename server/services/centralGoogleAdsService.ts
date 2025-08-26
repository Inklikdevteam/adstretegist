import { db } from "../db";
import { centralGoogleAdsConfig, googleAdsAccounts, type CentralGoogleAdsConfig, type InsertCentralGoogleAdsConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { GoogleAdsApi } from 'google-ads-api';

export class CentralGoogleAdsService {
  
  // Get the active centralized Google Ads configuration
  async getCentralConfig(): Promise<CentralGoogleAdsConfig | null> {
    const [config] = await db
      .select()
      .from(centralGoogleAdsConfig)
      .where(eq(centralGoogleAdsConfig.isActive, true))
      .limit(1);
    
    return config || null;
  }

  // Set up centralized Google Ads configuration
  async setCentralConfig(config: InsertCentralGoogleAdsConfig): Promise<CentralGoogleAdsConfig> {
    // Deactivate any existing configurations
    await db
      .update(centralGoogleAdsConfig)
      .set({ isActive: false });

    // Insert new configuration
    const [newConfig] = await db
      .insert(centralGoogleAdsConfig)
      .values({ ...config, isActive: true })
      .returning();

    // Update available accounts
    await this.updateAvailableAccounts();

    return newConfig;
  }

  // Update the list of available Google Ads accounts
  async updateAvailableAccounts(): Promise<void> {
    const config = await this.getCentralConfig();
    if (!config) {
      console.log('No central Google Ads configuration found');
      return;
    }

    try {
      const client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
      });

      // Get accessible customers
      const customersResponse = await client.listAccessibleCustomers(config.refreshToken);
      
      let foundCustomers = [];
      if (customersResponse.resource_names && Array.isArray(customersResponse.resource_names)) {
        foundCustomers = customersResponse.resource_names.map((resourceName: string) => {
          const customerId = resourceName.replace('customers/', '');
          return {
            id: customerId,
            customerId: customerId,
            customerName: `Google Ads Account ${customerId}`
          };
        });
      }

      // Check if this is a manager account by getting client accounts
      const customer = client.Customer({
        customer_id: config.customerId,
        refresh_token: config.refreshToken,
      });

      try {
        console.log(`DEBUG: Querying client accounts for manager customer ID: ${config.customerId}`);
        const clientAccountsResponse = await customer.query(`
          SELECT 
            customer_client.id,
            customer_client.descriptive_name,
            customer_client.manager,
            customer_client.test_account,
            customer_client.status
          FROM customer_client
          WHERE customer_client.status = 'ENABLED'
        `);

        console.log(`DEBUG: Raw client accounts response:`, clientAccountsResponse);

        if (clientAccountsResponse && clientAccountsResponse.length > 0) {
          // This is a manager account - use client accounts
          foundCustomers = clientAccountsResponse.map((row: any) => ({
            id: row.customer_client.id.toString(),
            customerId: row.customer_client.id.toString(),
            customerName: row.customer_client.descriptive_name || `Account ${row.customer_client.id}`,
            isPrimary: false,
            parentCustomerId: config.customerId
          }));
          console.log(`Manager account detected. Found ${foundCustomers.length} client accounts`);
        } else {
          // Regular account
          foundCustomers = [{
            id: config.customerId,
            customerId: config.customerId,
            customerName: config.customerName,
            isPrimary: true
          }];
        }
      } catch (clientError) {
        console.log('Not a manager account or no client accounts found, using main account');
        foundCustomers = [{
          id: config.customerId,
          customerId: config.customerId,
          customerName: config.customerName,
          isPrimary: true
        }];
      }

      // Clear existing accounts and insert new ones
      await db.delete(googleAdsAccounts);
      
      for (const customer of foundCustomers) {
        await db.insert(googleAdsAccounts).values({
          id: customer.id,
          customerId: customer.customerId,
          customerName: customer.customerName,
          isActive: true,
          isPrimary: customer.isPrimary || false,
          parentCustomerId: customer.parentCustomerId || null
        });
      }

      console.log(`Updated available Google Ads accounts: ${foundCustomers.length} accounts`);
    } catch (error) {
      console.error('Error updating available accounts:', error);
      throw error;
    }
  }

  // Get all available Google Ads accounts
  async getAvailableAccounts(): Promise<any[]> {
    const accounts = await db
      .select()
      .from(googleAdsAccounts)
      .where(eq(googleAdsAccounts.isActive, true));
    
    return accounts;
  }

  // Check if centralized configuration is set up
  async isConfigured(): Promise<boolean> {
    const config = await this.getCentralConfig();
    return config !== null;
  }
}