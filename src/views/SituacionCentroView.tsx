import React from 'react';
import { ActividadProfesoradoView } from './ActividadProfesoradoView';

/**
 * Backward compatibility wrapper:
 * «Situación del centro» has been reorganized and renamed to «Actividad del profesorado»,
 * integrated directly within the Admin panel.
 */
export const SituacionCentroView: React.FC = () => {
  return <ActividadProfesoradoView />;
};

export default SituacionCentroView;
