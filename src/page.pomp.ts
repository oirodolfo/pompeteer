import { ElementHandle, Page } from "puppeteer";
import { PompElement, PompElementCollection } from "./element.pomp";
import { PompTimeoutError, waitFor } from "./waitFor";

/** Page class to mimick a Page Object Modal.
 * Extend it with your base pages and use the selector methods to define the page's elements.
 */
export class PompPage {
  constructor(public page: Page) {}

  /** A single element xpath selector */
  $x<T extends PompElement = PompElement>(
    /** The xpath selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): T {
    const fetcher = async (timeout?: number) => {
      const el = await waitFor<ElementHandle<Element>>(
        this.page,
        async () => {
          const els = await this.page.$x(selector);
          return els[0];
        },
        timeout
      );
      if (!el) {
        throw new PompTimeoutError(this.page, selector, timeout);
      }
      return el;
    };
    return Type
      ? new Type(this.page, fetcher)
      : (new PompElement(this.page, fetcher) as T);
  }

  /** An element collection xpath selector */
  $$x<T extends PompElement = PompElement>(
    /** The xpath selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): PompElementCollection<T> {
    const fetcher = async (timeout?: number) => {
      await waitFor<ElementHandle<Element>>(
        this.page,
        async () => {
          const els = await this.page.$x(selector);
          return els[0];
        },
        timeout
      );
      const el = this.page.$x(selector);
      if (!el) {
        throw new PompTimeoutError(this.page, selector, timeout);
      }
      return el;
    };
    return new PompElementCollection<T>(this.page, fetcher, Type);
  }

  /** A single element css selector */
  $<T extends PompElement = PompElement>(
    /** The css selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): T {
    const fetcher = async (timeout?: number) =>
      this.page.waitForSelector(selector, { timeout }) as Promise<
        ElementHandle<Element>
      >;
    return Type
      ? new Type(this.page, fetcher)
      : (new PompElement(this.page, fetcher) as T);
  }

  /** An element collection css selector */
  $$<T extends PompElement = PompElement>(
    /** The css selector */
    selector: string,
    /** A custom element class */
    Type?: new (
      page: Page,
      fetch: (timeout?: number) => Promise<ElementHandle<Element>>
    ) => T
  ): PompElementCollection<T> {
    const fetcher = async (timeout?: number) => {
      await this.page.waitForSelector(selector, { timeout }).catch(() => {});
      const els = await this.page.$$(selector);
      return els;
    };
    return new PompElementCollection<T>(this.page, fetcher, Type);
  }
}
