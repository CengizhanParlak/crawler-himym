import { saver } from './pdf-generator/saver';
import { getEpisodeListOnPage, getScript } from './crawler/crawler';
import { FunctionError } from './lib/error.handler';

async function test() {
  const episodeList = await getEpisodeListOnPage(0);
  if (episodeList instanceof FunctionError) {
    console.log(episodeList.trace);
    console.error(episodeList);
    return null;
  }

  const scriptPromiseList = episodeList.map((ep) => getScript(ep));
  const settledScriptList = await Promise.allSettled(scriptPromiseList);

  const [scriptList, errorList] = settledScriptList.reduce(
    ([s, e], promiseResult, i) => {
      const { title } = episodeList[i];
      if (promiseResult.status === 'rejected') return [[...s], [...e, { title, error: promiseResult.reason }]];
      else {
        const { value } = promiseResult;
        if (value instanceof FunctionError) return [[...s], [...e, { title, error: value }]];
        else return [[...s, { title, script: value }], [...e]];
      }
    },
    [[], []] as [{ title: string; script: (Line | SceneCue)[] }[], { title: string; error: any }[]]
  );
  
  if (errorList.length > 0) {
    console.log(`=== Error List ${errorList.length}/${episodeList.length} ===`);
    errorList.forEach((e) => {
      console.log(e.title);
      e.error instanceof FunctionError ? console.log(e.error.trace) : console.log(e.error);
    });
  }
  
  await saver(scriptList);
}

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
  

test();
