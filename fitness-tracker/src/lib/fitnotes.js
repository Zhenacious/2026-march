import Papa from 'papaparse';

function parseTimeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string' || timeStr.trim() === '') return 0;
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    const seconds = parseInt(parts[2], 10) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return minutes * 60 + seconds;
  }
  return 0;
}

export function parseFitNotesCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows = results.data
            .filter((row) => {
              const exercise = row['Exercise'] || row['exercise'] || '';
              return exercise.trim() !== '';
            })
            .map((row) => {
              const date = (row['Date'] || row['date'] || '').trim();
              const exercise = (row['Exercise'] || row['exercise'] || '').trim();
              const category = (row['Category'] || row['category'] || '').trim();
              const weightRaw = row['Weight (kg)'] || row['weight_kg'] || row['Weight'] || '0';
              const repsRaw = row['Reps'] || row['reps'] || '0';
              const distanceRaw = row['Distance'] || row['distance'] || '0';
              const distanceUnit = (row['Distance Unit'] || row['distance_unit'] || '').trim();
              const timeRaw = row['Time'] || row['time'] || '';

              const weight_kg = parseFloat(weightRaw) || 0;
              const reps = parseInt(repsRaw, 10) || 0;
              const distance = parseFloat(distanceRaw) || 0;
              const duration_seconds = parseTimeToSeconds(timeRaw);

              return {
                date,
                exercise,
                category,
                weight_kg,
                reps,
                distance,
                distance_unit: distanceUnit,
                duration_seconds,
              };
            });

          resolve(rows);
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
