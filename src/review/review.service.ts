

import { HttpService } from '@nestjs/axios';
import {Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  
    async fetchAllFacebookComments(postId: string, pageAccessToken: string) {
      let comments = [];
      let nextPageUrl = `https://graph.facebook.com/v19.0/${postId}/comments?fields=id,from,message,created_time,message_tags&access_token=${pageAccessToken}`;
  
      while (nextPageUrl) {
        try {
          const response = await firstValueFrom(this.httpService.get(nextPageUrl));
          comments.push(...response.data.data);
          nextPageUrl = response.data.paging?.next || null;
        } catch (error) {
          console.error('Error fetching comments:', error.response?.data || error.message);
          throw new Error('Failed to fetch Facebook comments');
        }
      }
  
      return comments;
    }
  
    async fetchFacebookPosts(pageId: string, pageAccessToken: string) {
      const url = `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,created_time&access_token=${pageAccessToken}`;
  
      try {
        const response = await firstValueFrom(this.httpService.get(url));
        return response.data.data || [];
      } catch (error) {
        console.error('Error fetching posts:', error.response?.data || error.message);
        throw new Error('Failed to fetch Facebook posts');
      }
    }
  /*
    async fetchAndSaveAllFacebookComments(pageId: string, pageAccessToken: string, businessId: string) {
      try {
        const posts = await this.fetchFacebookPosts(pageId, pageAccessToken);
        const allComments = [];
  
        for (const post of posts) {
          try {
            const comments = await this.fetchAllFacebookComments(post.id, pageAccessToken);
            
            for (const comment of comments) {
              // Vérifier si le commentaire existe déjà
              const existingReview = await this.prisma.review.findFirst({
                where: { 
                  businessId, 
                  platformId: comment.id 
                }
              });
  
              if (!existingReview && comment.message) {
                const newReview = await this.prisma.review.create({
                  data: {
                    businessId,
                    platformId: comment.id,
                    author: comment.from?.name || 'Anonymous',
                    message: comment.message,
                    createdAt: new Date(comment.created_time),
                    sentiment: await this.analyzeSentiment(comment.message), // Optionnel
                  }
                });
                allComments.push(newReview);
              }
            }
          } catch (postError) {
            console.error(`Error processing post ${post.id}:`, postError);
          }
        }
  
        return allComments;
      } catch (error) {
        console.error('Error in fetchAndSaveAllFacebookComments:', error);
        throw error;
      }
    }
  */

    async fetchAndSaveAllFacebookComments(pageId: string, pageAccessToken: string, businessId: string) {
      console.log(`Starting sync for business ${businessId}, page ${pageId}`);
      
      try {
        const posts = await this.fetchFacebookPosts(pageId, pageAccessToken);
        console.log(`Found ${posts.length} posts`);
    
        const allComments = [];
    
        for (const post of posts) {
          try {
            const comments = await this.fetchAllFacebookComments(post.id, pageAccessToken);
            console.log(`Found ${comments.length} comments in post ${post.id}`);
            
            for (const comment of comments) {
              const existingReview = await this.prisma.review.findFirst({
                where: { 
                  businessId, 
                  platformId: comment.id 
                }
              });
    
              if (!existingReview && comment.message) {
                console.log(`Creating new review for comment ${comment.id}`);
                const newReview = await this.prisma.review.create({
                  data: {
                    businessId,
                    platformId: comment.id,
                    author: comment.from?.name || comment.from?.username || comment.author || 'Facebook User',
                    message: comment.message,
                    createdAt: new Date(comment.created_time),
                    sentiment: await this.analyzeSentiment(comment.message),
                  }
                });
                allComments.push(newReview);
              }
            }
          } catch (postError) {
            console.error(`Error processing post ${post.id}:`, postError);
          }
        }
    
        console.log(`Sync completed. Created ${allComments.length} new comments`);
        return allComments;
      } catch (error) {
        console.error('Sync failed:', error);
        throw error;
      }
    }
    private async analyzeSentiment(message: string): Promise<string> {
      // Implémentez votre logique d'analyse de sentiment ici
      // Retournez 'positive', 'negative' ou 'neutral'
      return 'neutral'; // Valeur par défaut
    }


    async getBusinessReviews(businessId: string) {
      console.log(`Fetching reviews for business: ${businessId}`);
      
      try {
        const reviews = await this.prisma.review.findMany({
          where: { businessId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            platformId: true,
            author: true,
            message: true,
            sentiment: true,
            response: true,
            createdAt: true
          }
        });
  
        console.log(`Found ${reviews.length} reviews`);
        return { 
          success: true,
          data: reviews,  
          count: reviews.length
        };
      } catch (error) {
        console.log(`Failed to fetch reviews: ${error.message}`);
        throw error;
      }
    }
  }