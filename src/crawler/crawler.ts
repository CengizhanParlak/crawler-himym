import axios from 'axios';
import * as cheerio from 'cheerio';
import { asyncErrorTracer, FunctionError } from '../lib/error.handler';

const BASE_URL = 'https://transcripts.foreverdreaming.org';
const GAP = 25;

const getDOM = asyncErrorTracer(async function getDOM(url: string) {
  try {
    const res = await axios.get(url);
    return cheerio.load(res.data);
  } catch (error) {
    const message = `getDOM error: ${url}\n`;
    if (error instanceof Error) {
      const err = new FunctionError(error);
      err.addTrace(message);
      return err;
    } else {
      console.error(error);
      return new FunctionError(message);
    }
  }
});

export const getScript = asyncErrorTracer(async function getScript({ title, url }: Episode) {
    const $ = await getDOM(url);
    if ($ instanceof FunctionError) return $;
  
    const contentHtml = $('.content').html();
  
    const script: (Line | SceneCue)[] = [];
  
    if (contentHtml) {
      const paragraphs = contentHtml.split('<br>');
      paragraphs.forEach((paragraph) => {
        paragraph = paragraph.trim();
        
        // Handle scene cues in italics or parentheses
        if (paragraph.startsWith('<em') || paragraph.startsWith('(')) {
          script.push({
            type: 'sceneCue',
            content: paragraph.replace(/<[^>]*>/g, '').replace(/^\(|\)$/g, '').trim()
          });
          return;
        }
        
        // Handle [END] or similar markers
        if (paragraph.startsWith('[') && paragraph.endsWith(']')) {
          script.push({
            type: 'sceneCue',
            content: paragraph.trim()
          });
          return;
        }
  
        // Handle character dialogue
        if (paragraph.includes(':')) {
          const [character, dialogue] = paragraph.split(':');
          if (character && dialogue) {
            script.push({
              type: 'dialogue',
              character: character.replace(/<[^>]*>/g, '').trim(),
              dialogue: dialogue.replace(/<[^>]*>/g, '').trim()
            });
          }
        } else if (paragraph.startsWith('<strong class="text-strong">') && paragraph.includes('</strong>:')) {
          const [character, dialogue] = paragraph.split('</strong>:');
          if (character && dialogue) {
            script.push({
              type: 'dialogue',
              character: character.replace(/<[^>]*>/g, '').trim(),
              dialogue: dialogue.replace(/<[^>]*>/g, '').trim()
            });
          }
        }
      });
    }
  
    console.log(`getScript done: ${title}`);
    return script;
  });
  
  // Update type definitions
  type Line = {
    type: 'dialogue';
    character: string;
    dialogue: string;
  };
  
  type SceneCue = {
    type: 'sceneCue';
    content: string;
  };

// test
export const getEpisodeListOnPage = asyncErrorTracer(async function getEpisodeListOnPage(page: number) {
  const episodeList: Episode[] = [];
  const $ = await getDOM(`${BASE_URL}/viewforum.php?f=177&start=${GAP * page}`);
  if ($ instanceof FunctionError) return $;

  const aList = $('.topics li .topictitle');

  aList.each((i, a) => {
      const aTag = $(a);
      const title = aTag.text();
      const url = BASE_URL + aTag.attr('href')!.slice(1); // Assuming href="./viewtopic.php?t=XXXXX", adjust as necessary
      episodeList.push({ title, url });
  });

  return episodeList;
});

export const getEpisodeList = asyncErrorTracer(async function getEpisodeList(pageNum: number) {
  let episodeList: Episode[] = [];

  for (let page = 0; page < pageNum; page++) {
    const episodeListOnAPage = await getEpisodeListOnPage(page);
    if (episodeListOnAPage instanceof FunctionError) return episodeListOnAPage;

    episodeList = [...episodeList, ...episodeListOnAPage];
  }
  return episodeList;
});
