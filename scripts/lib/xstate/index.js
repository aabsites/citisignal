export function createMachine(config) {
  return {
    ...config,
    createActor: (options = {}) => {
      let currentState = config.initial;
      let context = { ...config.context };
      const subscribers = new Set();

      const actor = {
        send: (event) => {
          const state = config.states[currentState];
          if (!state) return;

          // Handle state transitions
          if (state.on && state.on[event.type]) {
            const transition = state.on[event.type];
            if (transition.actions) {
              transition.actions.forEach(action => {
                if (config.actions[action]) {
                  config.actions[action](context, event);
                }
              });
            }
            currentState = transition.target;
          }

          // Handle always transitions
          if (state.always) {
            const alwaysTransition = Array.isArray(state.always) 
              ? state.always.find(t => !t.guard || t.guard(context, event))
              : state.always;
            
            if (alwaysTransition) {
              currentState = alwaysTransition.target;
            }
          }

          // Notify subscribers
          subscribers.forEach(subscriber => {
            subscriber.next({ value: currentState, context });
          });
        },

        subscribe: (subscriber) => {
          subscribers.add(subscriber);
          subscriber.next({ value: currentState, context });
          return {
            unsubscribe: () => subscribers.delete(subscriber)
          };
        },

        start: () => {
          // Initial state entry actions
          const initialState = config.states[currentState];
          if (initialState.entry) {
            initialState.entry.forEach(action => {
              if (config.actions[action]) {
                config.actions[action](context);
              }
            });
          }
        }
      };

      return actor;
    }
  };
}

export function createActor(machine, options = {}) {
  return machine.createActor(options);
} 