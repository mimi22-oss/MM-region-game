import { memo } from 'react';
import { THARSI_SCHOOL_COMPOUND } from '../../../data/villages/tharsi/schoolCampus';
import { SchoolCampusView } from '../../SchoolCampusView';

/** သာစည် အခြေခံပညာကျောင်း — Reuses shared Singleton `<SchoolCampusView>` with zero duplication */
export const TharSiSchool = memo(function TharSiSchool() {
  return <SchoolCampusView spec={THARSI_SCHOOL_COMPOUND} />;
});
