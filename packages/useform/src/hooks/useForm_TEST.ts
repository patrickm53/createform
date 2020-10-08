import React from "react";
import dot from 'dot-prop-immutable'
import { Observable } from "../core/observable";
import { Action, BaseState, useFormTestReducer } from "./useForm_TEST.reducer";
import { Reducer } from "react";
import { debounce } from "../utils";
import { ValidationError, Schema as YupSchema } from "yup";


type Options<T> = {
   initialValues?: T,
   initialErrors?: T,
   initialTouched?: T,
   isControlled?: boolean,
   debounced?: number,
   validateOnChange?: boolean
   validateOnBlur?: boolean
   validateOnSubmit?: boolean
   schemaValidation?: YupSchema<T>
}

type Ref = {
   current: HTMLInputElement
}

type Change = React.ChangeEvent<HTMLInputElement>

export function useFormTest<TO extends Options<TO['initialValues']>>(options: TO) {

   const { current: values$ } = React.useRef(new Observable(options.initialValues || {}))
   const { current: touched$ } = React.useRef(new Observable(options.initialTouched || {}))
   const { current: errors$ } = React.useRef(new Observable(options.initialErrors || {}))

   const refs = React.useRef<{ current: { [key: string]: Ref } }>({} as any)

   const [state, dispatch] = React.useReducer<Reducer<BaseState<TO['initialValues']>, Action>>(
      useFormTestReducer,
      {
         values: options.initialValues || {},
         error: options.initialErrors || {},
         touched: options.initialTouched || {},
         isValid: isValid(options.initialValues)
      })

   const dispatchDebounced = React.useCallback(debounce(dispatch, options.debounced || 300), [])


   function register(path: string) {
      const newRefs = {
         ...refs.current,
         [path]: React.createRef<Ref>()
      }

      refs.current = newRefs
      return { name: path, ref: refs.current[path] }
   }

   function handleEvent(event: string) {
      if (event === 'input') {
         return (e: Change) => {
            const nextState = dot.set(values$.get, e.target.name, e.target.value)
            values$.set = nextState
            validate(nextState)
         }
      }

      return (e: Change) => {
         const nextState = dot.set(touched$.get, e.target.name, true)
         touched$.set = nextState
      }
   }

   function addEvents(...args: Array<string>) {
      Object.keys(refs.current).forEach(key => {
         args.forEach(event => refs.current[key].current.addEventListener(event, handleEvent(event)))
      })
   }

   function removeEvents(...args: Array<string>) {
      Object.keys(refs.current).forEach(key => {
         args.forEach(event => refs.current[key].current.removeEventListener(event, handleEvent(event)))
      })
   }

   function setRefValue(path: string, value: any) {
      refs.current[path].current.value = value || null
   }

   function setForm(e: Partial<TO['initialValues']>) {
      values$.set = e
      Object.keys(refs.current).forEach(key => {
         setRefValue(key, dot.get(e, key) || dot.get(values$.get, key))
      })
   }

   function resetForm() {
      Object.keys(refs.current).forEach(key => {
         setRefValue(key, dot.get(options.initialValues, key) || null)
         setForm(dot.set(values$.get, key, dot.get(options.initialValues || {}, key) || null))
      })
   }

   function setTouched(e: Partial<TO['initialTouched']>) {
      touched$.set = e
   }

   function resetTouched(e: Partial<TO['initialTouched']>) {
      Object.keys(refs.current).forEach(key => {
         touched$.set = dot.set(values$.get, key, dot.get(options.initialTouched || {}, key) || false)
      })
   }


   function handleChanges(e: Action) {
      if (options.isControlled) {
         return dispatch(e)
      } else if (options.debounced) {
         return dispatchDebounced(e)
      }
   }

   function onSubmit(fn: (values: TO['initialValues']) => void) {
      return (e: React.BaseSyntheticEvent) => {
         e.preventDefault()

         if (state.isValid) {
            fn(values$.get)
         }

      }
   }

   function isValid(values) {
      return options.schemaValidation.isValidSync(values)
   }


   /**
    * 
    *  needs make a object with all properties with value empty
    */
   function validate(values) {
      options.schemaValidation?.validate(values, { abortEarly: false })
         .then((e) => {

            errors$.set = {}
         })
         .catch((e: ValidationError) => {
            e.inner.forEach(key => {
               const path = key.path
                  .split('[')
                  .join('.')
                  .split(']')
                  .join('')


               errors$.set = dot.set({}, path, key.message)
            })
         })
   }
   //
   //
   //
   //
   //
   //


   React.useEffect(() => {
      const valuesSubscriber = values$.subscribe(e => handleChanges({ type: 'input', payload: e }))
      const touchedSubscriber = touched$.subscribe(e => handleChanges({ type: 'blur', payload: e }))
      const errorsSubscriber = errors$.subscribe(e => { console.log(e) })

      return () => {
         valuesSubscriber()
         touchedSubscriber()
         errorsSubscriber()
      }
   }, [])

   React.useEffect(() => {
      addEvents('input', 'blur')
      return () => {
         removeEvents('input', 'blur')
      }
   }, [refs])

   return { register, state, resetForm, setForm, setTouched, resetTouched, onSubmit }

}
