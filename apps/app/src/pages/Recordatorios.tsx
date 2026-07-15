import { useMemo, useState, type FormEvent } from 'react';
import { IonButton, IonContent, IonIcon, IonModal, IonPage, IonRouterLink, IonToast } from '@ionic/react';
import { addOutline, alarmOutline, barbellOutline, checkmarkCircleOutline, chevronBack, closeOutline, notificationsOutline, restaurantOutline, waterOutline, medicalOutline, chatbubbleEllipsesOutline, trashOutline } from 'ionicons/icons';
import { BrandMark } from '../components/BrandMark';
import type { VitamateSnapshot } from '../data/localRepository';
import { REMINDER_KIND_LABELS, type ReminderKind, type WellnessReminder } from '../models/reminders';

interface Props {
  snapshot: VitamateSnapshot;
  onSave(input: Omit<WellnessReminder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): void;
  onDelete(id: string): void;
  onComplete(id: string): void;
  onEnableNotifications(): Promise<unknown>;
}

const dayLabels = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const allDays = [0, 1, 2, 3, 4, 5, 6];
const kindIcons: Record<ReminderKind, string> = { water: waterOutline, medication: medicalOutline, meal: restaurantOutline, workout: barbellOutline, vitacoach: chatbubbleEllipsesOutline, custom: alarmOutline };

const Recordatorios = ({ snapshot, onSave, onDelete, onComplete, onEnableNotifications }: Props) => {
  const [editing, setEditing] = useState<WellnessReminder | null | 'new'>(null);
  const [kind, setKind] = useState<ReminderKind>('water');
  const [title, setTitle] = useState('Tomar agua');
  const [details, setDetails] = useState('Un vaso ahora suma a tu energía y recuperación.');
  const [time, setTime] = useState('09:00');
  const [weekdays, setWeekdays] = useState<number[]>(allDays);
  const [message, setMessage] = useState('');
  const [permissionBusy, setPermissionBusy] = useState(false);
  const today = new Date().getDay();
  const completedToday = useMemo(() => new Set(snapshot.reminderLogs.filter((entry) => new Date(entry.completedAt).toDateString() === new Date().toDateString() && entry.outcome === 'completed').map((entry) => entry.reminderId)), [snapshot.reminderLogs]);
  const activeToday = snapshot.reminders.filter((reminder) => reminder.enabled && reminder.weekdays.includes(today)).sort((a, b) => a.times[0].localeCompare(b.times[0]));

  const openNew = (preset?: Partial<Pick<WellnessReminder, 'kind' | 'title' | 'details' | 'times' | 'weekdays'>>) => {
    setEditing('new');
    setKind(preset?.kind ?? 'custom');
    setTitle(preset?.title ?? '');
    setDetails(preset?.details ?? '');
    setTime(preset?.times?.[0] ?? '09:00');
    setWeekdays(preset?.weekdays ?? allDays);
  };
  const openEdit = (reminder: WellnessReminder) => {
    setEditing(reminder); setKind(reminder.kind); setTitle(reminder.title); setDetails(reminder.details); setTime(reminder.times[0]); setWeekdays(reminder.weekdays);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !/^\d{2}:\d{2}$/.test(time) || !weekdays.length) return setMessage('Completa el nombre, horario y al menos un día.');
    onSave({ id: editing && editing !== 'new' ? editing.id : undefined, kind, title: title.trim(), details: details.trim(), times: [time], weekdays: [...weekdays].sort(), enabled: editing && editing !== 'new' ? editing.enabled : true });
    setEditing(null); setMessage('Recordatorio guardado. Activa las notificaciones para recibirlo aunque VITAMATE esté cerrado.');
  };
  const enable = async () => {
    setPermissionBusy(true);
    try { await onEnableNotifications(); setMessage('Notificaciones activadas. VITAMATE respetará los horarios que elegiste.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos activar las notificaciones.'); }
    finally { setPermissionBusy(false); }
  };

  const createHydrationPlan = () => {
    ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].forEach((scheduledTime) => {
      onSave({ kind: 'water', title: 'Momento de hidratarte', details: 'Toma agua con calma. Regístralo cuando termines.', times: [scheduledTime], weekdays: allDays, enabled: true });
    });
    setMessage('Plan de hidratación creado · cada 2 horas de 08:00 a 20:00');
  };

  return <IonPage className="app-page"><IonContent fullscreen><main className="page-shell reminders-shell">
    <header className="app-header"><BrandMark compact /><IonRouterLink routerLink="/hoy" className="reminders-back"><IonIcon icon={chevronBack} /> Hoy</IonRouterLink></header>
    <section className="page-title page-title--action"><div><p className="eyebrow">Rutinas de bienestar</p><h1>Lo importante, en el momento justo.</h1><p>Programa agua, medicamentos, suplementos, comidas y entrenamientos. Tus horarios quedan ligados a tu cuenta y se ejecutan localmente en tu iPhone.</p></div><IonButton className="primary-button" onClick={() => openNew()}><IonIcon slot="start" icon={addOutline} />Nuevo</IonButton></section>

    <section className="notification-permission-card"><span><IonIcon icon={notificationsOutline} /></span><div><strong>Notificaciones inteligentes</strong><p>VITAMATE sólo te avisará de lo que tú programes. Puedes cambiarlo o pausarlo en cualquier momento.</p></div><IonButton fill="outline" disabled={permissionBusy} onClick={() => void enable()}>{permissionBusy ? 'Activando…' : 'Activar avisos'}</IonButton></section>

    <section className="reminder-presets"><button onClick={createHydrationPlan}><IonIcon icon={waterOutline} /><span><strong>Hidratación cada 2 horas</strong><small>08:00 a 20:00 · todos los días</small></span></button><button onClick={() => openNew({ kind: 'medication', title: 'Tomar medicamento o suplemento', details: 'Sigue siempre la indicación de tu profesional o la etiqueta.', times: ['09:00'] })}><IonIcon icon={medicalOutline} /><span><strong>Medicamento o suplemento</strong><small>Dosis y horario personalizados</small></span></button><button onClick={() => openNew({ kind: 'workout', title: 'Entrenamiento programado', details: 'Tu sesión está lista. Abre VITAMATE para comenzar.', times: ['18:00'], weekdays: [1, 3, 5] })}><IonIcon icon={barbellOutline} /><span><strong>Programar entrenamiento</strong><small>Elige días y hora</small></span></button></section>

    <section className="today-reminders"><header><div><p className="eyebrow">Hoy</p><h2>{activeToday.length ? `${activeToday.length} recordatorios programados` : 'Tu día está libre'}</h2></div><span>{completedToday.size} completados</span></header>{activeToday.length ? <div className="reminder-timeline">{activeToday.flatMap((reminder) => reminder.times.map((scheduledTime) => <article key={`${reminder.id}-${scheduledTime}`} className={completedToday.has(reminder.id) ? 'is-complete' : ''}><time>{scheduledTime}</time><span className={`reminder-icon reminder-icon--${reminder.kind}`}><IonIcon icon={kindIcons[reminder.kind]} /></span><button className="reminder-description" onClick={() => openEdit(reminder)}><strong>{reminder.title}</strong><small>{reminder.details || REMINDER_KIND_LABELS[reminder.kind]}</small></button><button className="reminder-done" aria-label={`Marcar ${reminder.title} como completado`} onClick={() => { onComplete(reminder.id); setMessage('Listo. Tu constancia quedó registrada.'); }}><IonIcon icon={checkmarkCircleOutline} /></button></article>))}</div> : <div className="empty-state"><span><IonIcon icon={alarmOutline} /></span><h2>Sin recordatorios para hoy</h2><p>Crea uno desde las opciones superiores. Puedes mantenerlo diario o elegir días específicos.</p></div>}</section>

    {snapshot.reminders.length > 0 && <section className="all-reminders"><h2>Todos tus recordatorios</h2>{snapshot.reminders.map((reminder) => <article key={reminder.id}><button className="reminder-toggle" aria-label={reminder.enabled ? 'Pausar recordatorio' : 'Activar recordatorio'} aria-pressed={reminder.enabled} onClick={() => onSave({ ...reminder, enabled: !reminder.enabled })}><i /></button><button className="reminder-summary" onClick={() => openEdit(reminder)}><strong>{reminder.title}</strong><small>{reminder.times.join(', ')} · {reminder.weekdays.length === 7 ? 'todos los días' : `${reminder.weekdays.length} días/semana`}</small></button><button className="icon-button" aria-label="Eliminar recordatorio" onClick={() => onDelete(reminder.id)}><IonIcon icon={trashOutline} /></button></article>)}</section>}
  </main></IonContent>
  <IonModal isOpen={Boolean(editing)} onDidDismiss={() => setEditing(null)} className="reminder-modal"><form className="reminder-form" onSubmit={submit}><button type="button" className="subscription-close" aria-label="Cerrar" onClick={() => setEditing(null)}><IonIcon icon={closeOutline} /></button><p className="eyebrow">Recordatorio</p><h2>{editing === 'new' ? 'Crear una rutina' : 'Editar rutina'}</h2><label className="field"><span>Tipo</span><select value={kind} onChange={(event) => setKind(event.target.value as ReminderKind)}>{Object.entries(REMINDER_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Nombre</span><input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Vitamina D" /></label><label className="field"><span>Nota o dosis</span><input value={details} maxLength={180} onChange={(event) => setDetails(event.target.value)} placeholder="Ej. 1 cápsula con el desayuno" /></label><label className="field"><span>Hora</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label><fieldset><legend>Días</legend><div className="weekday-picker">{dayLabels.map((label, day) => <button key={day} type="button" className={weekdays.includes(day) ? 'is-active' : ''} aria-pressed={weekdays.includes(day)} onClick={() => setWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}>{label}</button>)}</div></fieldset><IonButton type="submit" expand="block" className="primary-button">Guardar recordatorio</IonButton></form></IonModal><IonToast isOpen={Boolean(message)} message={message} duration={3500} onDidDismiss={() => setMessage('')} /></IonPage>;
};

export default Recordatorios;
