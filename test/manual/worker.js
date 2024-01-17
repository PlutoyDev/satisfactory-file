/// <reference no-default-lib="true"/>
/// <reference lib="webworker" />
/// <reference lib="esnext" />

import { readSave } from 'satisfactory-save-reader';

// Read the save file
onmessage = async event => {
  const { stream } = event.data;
  console.time;
  await readSave(stream, {
    onHeader: h => console.log('onHeader', h),
    onValidationGrids: g => console.log('onValidationGrids', g),
    onPerLevelStreamingLevelDataMap: m =>
      console.log('onPerLevelStreamingLevelDataMap', m),
    onPersistentLevel: {
      objectPerPage: 100,
      onObjectsPage: (objects, index, total) => {
        // find objects with extra data
        for (const obj of objects) {
          if ('extraData' in obj) {
            console.warn(
              `Object with class ${obj.className} has extra data}`,
              obj
            );
          }
        }
        console.log('onObjectsPage', { index, total });
      },
    },
    onUnresolvedDestroyedActors: a =>
      console.log('onUnresolvedDestroyedActors', a),
  });
};
