import path from 'path';
import { promises as fs } from 'fs';
import { Request } from '../src/utils/types/request.mjs';
import {
  filesFromRequests,
  sampleSourceCodePath,
  requestTypes,
} from './globals.mjs';

// Reverse filesFromRequest object to get requestType from file name
const requestsFromFiles = Object.fromEntries(
  Object.entries(filesFromRequests).map(([key, value]) => [value, key])
);

// Returns a promise for a collection of requests generated from the passed directory
// The problem argument is the problem for which the source code solves
// Each sub directory is treated as a supported language
export async function parseRequests(problem, requiredTypes, requiredLanguages) {
  // If undefined, assume all request types required
  if (requiredTypes === undefined) {
    requiredTypes = Object.keys(requestTypes);
  }

  // Check that passes directory exists
  await fs.access(sampleSourceCodePath).catch(() => {
    throw new Error(`Could not find ${sampleSourceCodePath} directory`);
  });

  // Iterates through the languages required
  // Returns an array of entries of [language, requests]
  return Object.fromEntries(
    await Promise.all(
      requiredLanguages.map(async (language) => {
        const languagePath = path.join(sampleSourceCodePath, language);
        const files = await fs.readdir(languagePath).catch(() => {
          throw new Error(`Could not find ${language} language directory`);
        });

        // Reading the files in the language dir and iterating through them Each
        // Returns an array of entries of [type, request]
        const requests = Object.fromEntries(
          (
            await Promise.all(
              files.map(async (file) => {
                // Reading the file, parsing the name, and adding to object
                const name = path.parse(file).name;
                const requestType = requestsFromFiles[name];
                if (requestType === undefined) {
                  throw new Error(
                    `${name} is not an expected request type filename`
                  );
                } else if (!requiredTypes.includes(requestType)) {
                  return;
                }
                const readContent = fs
                  .readFile(path.join(languagePath, file))
                  .then((buffer) => buffer.toString());

                // Returns [key, value] entry
                return [
                  requestType,
                  new Request(
                    `testing_${language}_${name}`,
                    problem,
                    await readContent,
                    language
                  ),
                ];
              })
            )
          ).filter((request) => request !== undefined)
        );

        // Identify missing request types by comparing arrays
        const foundTypes = Object.keys(requests);
        const missingTypes = requiredTypes.filter(
          (type) => !foundTypes.includes(type)
        );

        // Ensure all request type files included
        if (missingTypes.length > 0) {
          const missingTypesString = missingTypes.reduce((acc, red, i) => {
            // If one element, return element
            if (missingTypes.length == 1) {
              return filesFromRequests[red];
            }

            // Parses array of strings into string split by ',' and 'and'
            acc += filesFromRequests[red];
            if (i === missingTypes.length - 2) {
              acc += ' and ';
            } else if (i < missingTypes.length - 2) {
              acc += ', ';
            }
            return acc;
          }, '');

          throw new Error(
            `${language} directory is missing ${missingTypesString} files`
          );
        }

        // Return object of language and requests
        return [language, requests];
      })
    )
  );
}
