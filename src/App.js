import React, {useEffect, useReducer} from 'react';
import { API } from 'aws-amplify';
import 'antd/dist/antd.css';
import { v4 as uuid } from 'uuid';
import { List, Input, Button } from 'antd';
import { SmileOutlined } from '@ant-design/icons';
import { listNotes } from './graphql/queries';
import { onCreateNote, onDeleteNote, onUpdateNote } from './graphql/subscriptions';
import {
  updateNote as UpdateNote,
  createNote as CreateNote,
  deleteNote as DeleteNote
} from './graphql/mutations';
import './App.css';

const CLIENT_ID = uuid();

const initialState = {
  notes: [],
  sorting: "AZ",
  loading: true,
  error: false,
  form: { name: '', description: '' }
};

const styles = {
  container: {padding: 20},
  input: {marginBottom: 10},
  item: { textAlign: 'left' },
  p: { color: '#1890ff' }
};

const reducer = (state, action) => {
  switch(action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.notes, loading: false };
    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes]};
    case 'RESET_FORM':
      return { ...state, form: initialState.form };
    case 'SET_INPUT':
      return { ...state, form: { ...state.form, [action.name]: action.value } };
    case 'UPDATE_NOTE':
      const updatedNoteIndex = state.notes.findIndex(n => n.id === action.note.id);
      const notes = [...state.notes]
        if (updatedNoteIndex !== -1) { 
            notes[updatedNoteIndex] = action.note;
        };
      return{...state, notes: notes};
    case 'SORT_NOTES':
      let newSort, sorted
        if (state.sortedNote === 'AZ') {
          newSort = 'ZA';
          sorted = state.notes.sort((a, b) => (a.name > b.name ? 1 : -1));
        } else {
          newSort = 'AZ';
          sorted = state.notes.sort((a, b) => (a.name < b.name ? 1 : -1));
        }
      return {...state, notes: sorted, sortedNote: newSort };
    case 'REMOVE_NOTE':
        const index = state.notes.findIndex(n=> n.id === action.id)
        const removeNotes = [
          ...state.notes.slice(0, index), 
          ...state.notes.slice(index + 1)
        ];
        return { ...state, notes: removeNotes };
    case 'ERROR':
        return { ...state, loading: false, error: true };
      default:
        return { ...state};
    }
  };

const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sort = () => {
    dispatch({ type: "SORT_NOTES" });
  };
  const fetchNotes = async() => {
    try {
        const notesData = await API.graphql({
          query: listNotes
        });
        dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items });
    } catch (err) {
        console.log('error: ', err);
        dispatch({ type: 'ERROR' });
        }
      };
  const createNote = async() => {
    const { form } = state;
      if (!form.name || !form.description) {
          return alert('please enter a name and description');
        };
    const note = { ...form, clientId: CLIENT_ID, completed: false, id: uuid() };
      dispatch({ type: 'ADD_NOTE', note });
      dispatch({ type: 'RESET_FORM' });
        try {
          await API.graphql({
            query: CreateNote,
            variables: { input: note }
          });
          console.log('successfully created note!');
        } catch (err) {
          console.log("error: ", err);
        };
  };
  const deleteNote = async({ id }) => {
    try {
      await API.graphql({
        query: DeleteNote,
        variables: { input: { id } }
        });
        console.log('successfully deleted note!');
    } catch (err) {
        console.error(err);
    };
  };
  const updateNote = async(note) => {
    const index = state.notes.findIndex(n => n.id === note.id);
    const notes = [...state.notes];
    notes[index].completed = !note.completed;
    dispatch({ type: 'SET_NOTES', notes});
    try {
      await API.graphql({
        query: UpdateNote,
        variables: { input: { id: note.id, completed: notes[index].completed } }
      });
        console.log('note successfully updated!');
    } catch (err) {
        console.error(err);
      }
    };
  const onChange = (e) => {
    dispatch({ type: "SET_INPUT", name: e.target.name, value: e.target.value });
  };
  useEffect(() => {
    fetchNotes();
    const createSubscription = API.graphql({
      query: onCreateNote,
     }).subscribe({
          next: (noteData) => {
            const note = noteData.value.data.onCreateNote;
            if (CLIENT_ID === note.clientId) return;
            dispatch({ type: "ADD_NOTE", note });
          },
        });
    const updateSubscription = API.graphql({
      query: onUpdateNote,
    })
      .subscribe({
        next: noteData => {
          const updatedNote = noteData.value.data.onUpdateNote;
          dispatch({ type: 'UPDATE_NOTE', note: updatedNote });
        }
      });
    const deleteSubscription = API.graphql({
      query: onDeleteNote,
    }).subscribe({
        next: (noteData) => {
          const noteId = noteData.value.data.onDeleteNote.id;
          dispatch({ type: "REMOVE_NOTE", id: noteId });
        },
      });
    return () => {
      createSubscription.unsubscribe();
      deleteSubscription.unsubscribe();
      updateSubscription.unsubscribe();
    };
  }, []);
  
  const renderItem = (item) => {
    return (
      <div>
      <List.Item 
        style={styles.item}
        actions={[
          <div>
            <h3>Another Task Bites The Dust</h3>
          <p style={styles.p} onClick={() => deleteNote(item)}>Click to Delete Me!</p>
          </div>,
          <br />,

             <div>
               <h3>Click Me When Done To Make Me Smile!</h3>
          <input type="checkbox" checked={item.completed ? true: false } onChange={()=> updateNote(item)} />,
          <p style={styles.p} onClick={() => updateNote(item)}>
            {item.completed ? <SmileOutlined /> : null}
          </p>
          </div>
        ]}>
      <List.Item.Meta title={item.name} description={item.description}/></List.Item>
      <hr />
      </div>
    )
  };
  return (
    <div style={styles.container}>
      <h2>So much to do and so little time...might as well add another item!</h2>
      <Input
        onChange={onChange}
        value={state.form.name}
        placeholder="Note Name"
        name='name'
        style={styles.input}
      />
      <Input
        onChange={onChange}
        value={state.form.description}
        placeholder="Note description"
        name='description'
        style={styles.input}
      />
      <Button onClick={createNote} type="primary">Create Note</Button>

      <Button onClick={sort} type="primary">Sort Notes</Button>
      <div>
      <h3>I Love It When This Number Is Zero! aka # To-Dos Left = {state.notes.filter(x => x.completed === false).length} </h3> 
      <h3>Total To-Dos = {state.notes.length}</h3>
      </div>

      <List
        loading={state.loading}
        dataSource={state.notes}
        renderItem={renderItem}
      />
    </div>
  );
};
export default App;
