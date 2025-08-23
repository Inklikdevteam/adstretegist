import { GoogleAdsApi, Customer } from 'google-ads-api';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  developerToken: string;
}

interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  type: string;
  budget: number;
  bidStrategy: string;
  targetCpa?: number;
  targetRoas?: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  ctr: number;
  avgCpc: number;
  conversionRate: number;
}

interface GoogleAdsKeyword {
  id: string;
  text: string;
  matchType: string;
  status: string;
  bid: number;
  qualityScore: number;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  avgCpc: number;
}

export class GoogleAdsService {
  private client: GoogleAdsApi;
  private customer: Customer;
  private oauth2Client: OAuth2Client;
  private config: GoogleAdsConfig;

  constructor(config: GoogleAdsConfig) {
    this.config = config;
    
    // Initialize OAuth2 client
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // For installed applications
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.refreshToken
    });

    // Initialize Google Ads API client
    this.client = new GoogleAdsApi({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      developer_token: config.developerToken,
    });

    this.customer = this.client.Customer({
      customer_id: config.customerId,
      refresh_token: config.refreshToken,
    });
  }

  async getCampaigns(selectedAccountIds?: string[]): Promise<GoogleAdsCampaign[]> {
    try {
      // First check if this is a manager account
      const clientAccounts = await this.getClientAccounts();
      
      if (clientAccounts.length > 0) {
        // This is a manager account - get campaigns from all client accounts
        const accountsToFetch = selectedAccountIds && selectedAccountIds.length > 0
          ? clientAccounts.filter(acc => selectedAccountIds.includes(acc.id))
          : clientAccounts;
          
        console.log(`Manager account detected. Fetching campaigns from ${accountsToFetch.length} client accounts...`);
        if (selectedAccountIds && selectedAccountIds.length > 0) {
          console.log(`DEBUG: Filtering for selected accounts:`, selectedAccountIds);
        }
        console.log('DEBUG: Available client accounts:', accountsToFetch.map(acc => ({ 
          id: acc.id, 
          name: acc.name 
        })));
        const allCampaigns: GoogleAdsCampaign[] = [];
        
        for (const clientAccount of accountsToFetch) {
          try {
            // Create a completely new client for each client account
            const clientGoogleAdsClient = new GoogleAdsApi({
              client_id: this.config.clientId,
              client_secret: this.config.clientSecret,
              developer_token: this.config.developerToken,
            });
            
            const clientCustomer = clientGoogleAdsClient.Customer({
              customer_id: clientAccount.id,
              refresh_token: this.config.refreshToken,
              login_customer_id: this.config.customerId,
            });
            
            const campaigns = await clientCustomer.query(`
              SELECT 
                campaign.id,
                campaign.name,
                campaign.status,
                campaign.advertising_channel_type,
                campaign_budget.amount_micros,
                campaign.bidding_strategy_type,
                campaign.target_cpa.target_cpa_micros,
                campaign.target_roas.target_roas,
                metrics.impressions,
                metrics.clicks,
                metrics.conversions,
                metrics.conversions_value,
                metrics.cost_micros,
                metrics.ctr,
                metrics.average_cpc,
                metrics.conversions_from_interactions_rate
              FROM campaign 
              WHERE campaign.status = 'ENABLED'
              AND segments.date DURING LAST_7_DAYS
            `);

            const clientCampaigns = campaigns.map((row: any) => ({
                id: row.campaign.id.toString(),
                name: `${clientAccount.name} - ${row.campaign.name}`,
                status: row.campaign.status,
                type: this.mapChannelType(row.campaign.advertising_channel_type),
                budget: row.campaign_budget.amount_micros / 1000000,
                bidStrategy: row.campaign.bidding_strategy_type,
                targetCpa: row.campaign.target_cpa?.target_cpa_micros / 1000000,
                targetRoas: row.campaign.target_roas?.target_roas,
                impressions: row.metrics.impressions || 0,
                clicks: row.metrics.clicks || 0,
                conversions: row.metrics.conversions || 0,
                conversionsValue: row.metrics.conversions_value || 0,
                cost: row.metrics.cost_micros / 1000000,
                ctr: row.metrics.ctr || 0,
                avgCpc: (row.metrics.average_cpc || 0) / 1000000, // Convert from micros to actual currency
                conversionRate: row.metrics.conversions_from_interactions_rate || 0,
            }));
            
            allCampaigns.push(...clientCampaigns);
            console.log(`Found ${clientCampaigns.length} campaigns from client account: ${clientAccount.name}`);
          } catch (clientError) {
            console.warn(`Error fetching campaigns from client account ${clientAccount.name}:`, clientError);
          }
        }
        
        return allCampaigns;
      } else {
        // Regular account - fetch campaigns directly
        const campaigns = await this.customer.query(`
          SELECT 
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign_budget.amount_micros,
            campaign.bidding_strategy_type,
            campaign.target_cpa.target_cpa_micros,
            campaign.target_roas.target_roas,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions,
            metrics.conversions_value,
            metrics.cost_micros,
            metrics.ctr,
            metrics.average_cpc,
            metrics.conversions_from_interactions_rate
          FROM campaign 
          WHERE campaign.status = 'ENABLED'
          AND segments.date DURING LAST_7_DAYS
        `);

        return campaigns.map((row: any) => ({
          id: row.campaign.id.toString(),
          name: row.campaign.name,
          status: row.campaign.status,
          type: this.mapChannelType(row.campaign.advertising_channel_type),
          budget: row.campaign_budget.amount_micros / 1000000,
          bidStrategy: row.campaign.bidding_strategy_type,
          targetCpa: row.campaign.target_cpa?.target_cpa_micros / 1000000,
          targetRoas: row.campaign.target_roas?.target_roas,
          impressions: row.metrics.impressions || 0,
          clicks: row.metrics.clicks || 0,
          conversions: row.metrics.conversions || 0,
          conversionsValue: row.metrics.conversions_value || 0,
          cost: row.metrics.cost_micros / 1000000,
          ctr: row.metrics.ctr || 0,
          avgCpc: (row.metrics.average_cpc || 0) / 1000000, // Convert from micros to actual currency
          conversionRate: row.metrics.conversions_from_interactions_rate || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching campaigns from Google Ads:', error);
      throw new Error('Failed to fetch campaigns from Google Ads API');
    }
  }

  async getKeywords(campaignId: string): Promise<GoogleAdsKeyword[]> {
    try {
      const keywords = await this.customer.query(`
        SELECT 
          ad_group_criterion.criterion_id,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          ad_group_criterion.cpc_bid_micros,
          ad_group_criterion.quality_info.quality_score,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM keyword_view 
        WHERE campaign.id = ${campaignId}
        AND segments.date DURING LAST_7_DAYS
      `);

      return keywords.map((row: any) => ({
        id: row.ad_group_criterion.criterion_id.toString(),
        text: row.ad_group_criterion.keyword.text,
        matchType: row.ad_group_criterion.keyword.match_type,
        status: row.ad_group_criterion.status,
        bid: row.ad_group_criterion.cpc_bid_micros / 1000000,
        qualityScore: row.ad_group_criterion.quality_info?.quality_score || 0,
        impressions: row.metrics.impressions || 0,
        clicks: row.metrics.clicks || 0,
        cost: row.metrics.cost_micros / 1000000,
        conversions: row.metrics.conversions || 0,
        ctr: row.metrics.ctr || 0,
        avgCpc: row.metrics.average_cpc || 0,
      }));
    } catch (error) {
      console.error('Error fetching keywords from Google Ads:', error);
      throw new Error('Failed to fetch keywords from Google Ads API');
    }
  }

  async applyCampaignChanges(campaignId: string, changes: any): Promise<boolean> {
    try {
      const operations = [];

      // Update campaign budget
      if (changes.budget) {
        operations.push({
          update: {
            resourceName: `customers/${this.customer.credentials.customer_id}/campaigns/${campaignId}`,
            campaign: {
              id: campaignId,
              campaign_budget: {
                amount_micros: changes.budget * 1000000 // Convert to micros
              }
            }
          }
        });
      }

      // Update target CPA
      if (changes.targetCpa) {
        operations.push({
          update: {
            resourceName: `customers/${this.customer.credentials.customer_id}/campaigns/${campaignId}`,
            campaign: {
              id: campaignId,
              target_cpa: {
                target_cpa_micros: changes.targetCpa * 1000000
              }
            }
          }
        });
      }

      // Update target ROAS
      if (changes.targetRoas) {
        operations.push({
          update: {
            resourceName: `customers/${this.customer.credentials.customer_id}/campaigns/${campaignId}`,
            campaign: {
              id: campaignId,
              target_roas: {
                target_roas: changes.targetRoas
              }
            }
          }
        });
      }

      if (operations.length > 0) {
        await this.customer.mutateResources(operations);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error applying campaign changes:', error);
      throw new Error('Failed to apply changes to Google Ads campaign');
    }
  }

  async updateKeywordBids(keywordUpdates: Array<{id: string, bid: number}>): Promise<boolean> {
    try {
      const operations = keywordUpdates.map(update => ({
        update: {
          resourceName: `customers/${this.customer.credentials.customer_id}/adGroupCriteria/${update.id}`,
          ad_group_criterion: {
            criterion_id: update.id,
            cpc_bid_micros: update.bid * 1000000
          }
        }
      }));

      if (operations.length > 0) {
        await this.customer.mutateResources(operations);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error updating keyword bids:', error);
      throw new Error('Failed to update keyword bids in Google Ads');
    }
  }

  private mapChannelType(channelType: string | number): string {
    // Convert numeric values to strings based on Google Ads API enum
    const numericChannelType = typeof channelType === 'number' ? channelType : parseInt(channelType);
    
    if (!isNaN(numericChannelType)) {
      switch (numericChannelType) {
        case 2:
          return 'Search';
        case 3:
          return 'Display';
        case 4:
          return 'Shopping';
        case 5:
          return 'Hotel';
        case 6:
          return 'Video';
        case 7:
          return 'App';  // Multi-channel campaigns (Universal App campaigns)
        case 8:
          return 'Local';
        case 9:
          return 'Smart';
        case 10:
          return 'Performance Max';
        case 11:
          return 'Local Services';
        case 12:
          return 'Discovery';  // Also known as Demand Gen campaigns
        case 13:
          return 'Travel';
        default:
          console.warn(`Unknown numeric channel type: ${channelType}`);
          return 'Unknown';
      }
    }
    
    // Handle string values for backward compatibility
    switch (channelType.toUpperCase()) {
      case 'SEARCH':
        return 'Search';
      case 'DISPLAY':
        return 'Display';
      case 'SHOPPING':
        return 'Shopping';
      case 'HOTEL':
        return 'Hotel';
      case 'VIDEO':
        return 'Video';
      case 'MULTI_CHANNEL':
        return 'App';  // Multi-channel campaigns (Universal App campaigns)
      case 'LOCAL':
        return 'Local';
      case 'SMART':
        return 'Smart';
      case 'PERFORMANCE_MAX':
        return 'Performance Max';
      case 'LOCAL_SERVICES':
        return 'Local Services';
      case 'DISCOVERY':
        return 'Discovery';  // Also known as Demand Gen campaigns
      case 'TRAVEL':
        return 'Travel';
      default:
        console.warn(`Unknown channel type: ${channelType}`);
        return 'Unknown';
    }
  }

  async getClientAccounts(): Promise<Array<{id: string, name: string}>> {
    try {
      console.log(`DEBUG: Querying client accounts for manager customer ID: ${this.config.customerId}`);
      
      const accounts = await this.customer.query(`
        SELECT 
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.manager,
          customer_client.test_account,
          customer_client.status
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
        AND customer_client.manager = false
        AND customer_client.test_account = false
      `);
      
      console.log(`DEBUG: Raw client accounts response:`, accounts.map((row: any) => ({
        id: row.customer_client.id?.toString(),
        name: row.customer_client.descriptive_name,
        manager: row.customer_client.manager,
        testAccount: row.customer_client.test_account,
        status: row.customer_client.status
      })));
      
      return accounts.map((row: any) => ({
        id: row.customer_client.id.toString(),
        name: row.customer_client.descriptive_name || `Account ${row.customer_client.id}`
      }));
    } catch (error) {
      console.log('No client accounts found or not a manager account');
      return [];
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.customer.query('SELECT customer.id FROM customer LIMIT 1');
      return true;
    } catch (error) {
      console.error('Google Ads API connection validation failed:', error);
      return false;
    }
  }
}

export { GoogleAdsConfig, GoogleAdsCampaign, GoogleAdsKeyword };