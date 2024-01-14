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
        console.log('onObjectsPage', { objects, index, total });
      },
    },
  });
};
