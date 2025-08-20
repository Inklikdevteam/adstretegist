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

  constructor(config: GoogleAdsConfig) {
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

  async getCampaigns(): Promise<GoogleAdsCampaign[]> {
    try {
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
          metrics.cost_micros,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions_from_interactions_rate
        FROM campaign 
        WHERE campaign.status != 'REMOVED'
        AND segments.date DURING LAST_7_DAYS
      `);

      return campaigns.map((row: any) => ({
        id: row.campaign.id.toString(),
        name: row.campaign.name,
        status: row.campaign.status,
        type: this.mapChannelType(row.campaign.advertising_channel_type),
        budget: row.campaign_budget.amount_micros / 1000000, // Convert from micros
        bidStrategy: row.campaign.bidding_strategy_type,
        targetCpa: row.campaign.target_cpa?.target_cpa_micros / 1000000,
        targetRoas: row.campaign.target_roas?.target_roas,
        impressions: row.metrics.impressions || 0,
        clicks: row.metrics.clicks || 0,
        conversions: row.metrics.conversions || 0,
        cost: row.metrics.cost_micros / 1000000,
        ctr: row.metrics.ctr || 0,
        avgCpc: row.metrics.average_cpc || 0,
        conversionRate: row.metrics.conversions_from_interactions_rate || 0,
      }));
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

  private mapChannelType(channelType: string): string {
    switch (channelType) {
      case 'SEARCH':
        return 'search';
      case 'DISPLAY':
        return 'display';
      case 'SHOPPING':
        return 'shopping';
      case 'VIDEO':
        return 'video';
      case 'MULTI_CHANNEL':
        return 'multi_channel';
      default:
        return 'unknown';
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